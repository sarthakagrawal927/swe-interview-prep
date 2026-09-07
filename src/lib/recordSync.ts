export interface RecordSyncConfig<T> {
  localKey: string;
  action: string;
  field: string;
  toPayload: (id: string, entry: T) => Record<string, unknown>;
}

type Operation<T> = { id: string; operationId: string; entry: T };
type Envelope<T> = { data: Record<string, T>; pending: Operation<T>[] };
type SyncStatus = 'local-only' | 'pending' | 'failed' | 'synced';
type Snapshot<T> = Envelope<T> & { status: SyncStatus; error: string | null };

/** Durable outbox: one stable operation per edit, serialized across navigation. */
export class RecordSyncStore<T> {
  readonly key: string;
  readonly config: RecordSyncConfig<T>;
  readonly accountId: string | null;
  private state: Snapshot<T>;
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight = false;
  private active = false;
  private revision = 0;
  private activation = 0;
  private readonly requests = new Set<AbortController>();

  constructor(config: RecordSyncConfig<T>, accountId: string | null) {
    this.config = config;
    this.accountId = accountId;
    this.key = accountId
      ? `${config.localKey}:account:${encodeURIComponent(accountId)}:v1`
      : config.localKey;
    let envelope: Envelope<T> = { data: {}, pending: [] };
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) || 'null');
      if (saved) envelope = accountId ? saved : { data: saved, pending: [] };
    } catch {
      /* A readable error is set if the next local save fails. */
    }
    this.state = { ...envelope, status: accountId ? 'pending' : 'local-only', error: null };
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(patch: Partial<Snapshot<T>>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private persist(): boolean {
    try {
      const { data, pending } = this.state;
      localStorage.setItem(this.key, JSON.stringify(this.accountId ? { data, pending } : data));
      return true;
    } catch {
      this.publish({
        status: 'failed',
        error: 'Changes are not saved in this browser. Free storage and retry before leaving.',
      });
      return false;
    }
  }

  set(id: string, update: T | ((previous: T | undefined) => T)) {
    const entry =
      typeof update === 'function'
        ? (update as (previous: T | undefined) => T)(this.state.data[id])
        : update;
    const pending = this.accountId
      ? [...this.state.pending, { id, entry, operationId: crypto.randomUUID() }]
      : [];
    this.revision += 1;
    this.publish({
      data: { ...this.state.data, [id]: entry },
      pending,
      error: null,
      status: this.accountId ? 'pending' : 'local-only',
    });
    if (!this.persist() || !this.accountId) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 500);
  }

  setActive(active: boolean) {
    if (this.active === active) return;
    this.active = active;
    this.activation += 1;
    if (!active) {
      clearTimeout(this.timer);
      for (const request of this.requests) request.abort();
      return;
    }
    void this.reconcile();
    void this.flush();
  }

  private async request(init: RequestInit = {}) {
    const controller = new AbortController();
    this.requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      return await fetch(
        `/api/learning?action=${this.config.action}&accountId=${encodeURIComponent(this.accountId ?? '')}`,
        {
          credentials: 'include',
          ...init,
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
      this.requests.delete(controller);
    }
  }

  async reconcile() {
    if (!this.active || !this.accountId) return;
    const revision = this.revision;
    const activation = this.activation;
    try {
      const response = await this.request();
      if (!response.ok)
        throw new Error('Could not read account progress. Your local changes remain available.');
      const remote = (await response.json())[this.config.field] || {};
      if (!this.active || activation !== this.activation || revision !== this.revision) return;
      const data = { ...this.state.data, ...remote };
      for (const operation of this.state.pending) data[operation.id] = operation.entry;
      this.publish({
        data,
        ...(this.state.pending.length ? {} : { status: 'synced', error: null }),
      });
      this.persist();
    } catch (error) {
      if (this.active && activation === this.activation)
        this.publish({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Account sync failed.',
        });
    }
  }

  retry = () => {
    if (!this.persist()) return;
    this.publish({ error: null, status: this.accountId ? 'pending' : 'local-only' });
    void this.reconcile();
    void this.flush();
  };

  async flush() {
    clearTimeout(this.timer);
    if (this.inFlight || !this.active || !this.accountId || !this.state.pending.length) return;
    if (!this.persist()) return;
    this.inFlight = true;
    const activation = this.activation;
    try {
      while (this.active && activation === this.activation && this.state.pending.length) {
        const operation = this.state.pending[0];
        const response = await this.request({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...this.config.toPayload(operation.id, operation.entry),
            accountId: this.accountId,
            operationId: operation.operationId,
          }),
        });
        if (!response.ok)
          throw new Error(
            'Saved in this browser, but account sync failed. Retry when connected to the original account.'
          );
        if (!this.active || activation !== this.activation) return;
        this.revision += 1;
        this.publish({
          pending: this.state.pending.filter((item) => item.operationId !== operation.operationId),
          error: null,
        });
        if (!this.persist()) return;
      }
      if (this.active && activation === this.activation) {
        this.publish({ status: 'synced', error: null });
        void this.reconcile();
      }
    } catch (error) {
      if (this.active && activation === this.activation)
        this.publish({
          status: 'failed',
          error:
            error instanceof Error ? error.message : 'Account sync failed; local work is retained.',
        });
    } finally {
      this.inFlight = false;
      if (this.active && activation !== this.activation) void this.flush();
    }
  }
}

const stores = new Map<string, RecordSyncStore<unknown>>();
let activeAccount: string | null = null;

export function activateRecordAccount(accountId: string | null) {
  activeAccount = accountId;
  for (const store of stores.values())
    store.setActive(Boolean(accountId) && store.accountId === accountId);
}

export function getRecordStore<T>(
  config: RecordSyncConfig<T>,
  accountId: string | null
): RecordSyncStore<T> {
  const key = JSON.stringify([config.localKey, accountId]);
  if (!stores.has(key)) {
    const store = new RecordSyncStore(config, accountId);
    stores.set(key, store as RecordSyncStore<unknown>);
  }
  return stores.get(key) as RecordSyncStore<T>;
}

export function retryRecordSync() {
  for (const store of stores.values()) {
    if (store.accountId === activeAccount) store.retry();
  }
}
