// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import drills from './drills.mjs';
import artifacts from './artifacts.mjs';
import projects from './projects.mjs';
import { setRequestDb } from '../shared/db/client.mjs';
import { createD1Client } from '../shared/db/d1-client.mjs';
import { RecordSyncStore } from '../src/lib/recordSync';
const config = {
  localKey: 'test-drills',
  action: 'drills',
  field: 'drills',
  toPayload: (drillId, entry) => ({
    drillId,
    ...entry,
  }),
};
const content = (lastCode) => ({ status: 'solved', lastCode });
const handlers = { drills, artifacts, projects };
let database;
let account = 'alice';
let stores;
function store(user = 'alice') {
  const result = new RecordSyncStore(config, user);
  stores.push(result);
  return result;
}
async function network(url, init = {}) {
  const action = new URL(String(url), 'http://local').searchParams.get('action');
  return handlers[action]({
    request: new Request(new URL(String(url), 'http://local'), init),
    user: { id: account },
    json: (body, options = {}) =>
      new Response(JSON.stringify(body), {
        ...options,
        headers: { 'content-type': 'application/json' },
      }),
  });
}
beforeEach(() => {
  account = 'alice';
  stores = [];
  const storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  });
  database = new DatabaseSync(':memory:');
  for (const migration of ['0001_initial.sql', '0003_record_sync_receipts.sql']) {
    database.exec(readFileSync(new URL(`../migrations/d1/${migration}`, import.meta.url), 'utf8'));
  }
  database.exec(
    "INSERT INTO users (id,google_id,email,name) VALUES ('alice','alice','alice@example.invalid','Alice'), ('bob','bob','bob@example.invalid','Bob')"
  );
  const binding = {
    prepare(sql) {
      const statement = database.prepare(sql);
      const bound = (args) => ({
        execute: () => ({
          results: statement.all(...args),
          meta: { changes: Number(database.prepare('SELECT changes() AS n').get()?.n) },
        }),
        all: async () => bound(args).execute(),
        bind: (...values) => bound(values),
      });
      return bound([]);
    },
    async batch(statements) {
      database.exec('BEGIN');
      try {
        const result = statements.map((statement) => statement.execute());
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
  setRequestDb(createD1Client(binding));
  vi.stubGlobal('fetch', vi.fn(network));
});
afterEach(() => {
  for (const item of stores) item.setActive(false);
  database.close();
  vi.unstubAllGlobals();
});
it('retains failed writes through reload and retries a lost acknowledgment without duplicate attempts', async () => {
  let fail = true;
  let loseAcknowledgment = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      if (init?.method === 'POST' && fail) return new Response('', { status: 503 });
      const response = await network(url, init);
      if (init?.method === 'POST' && loseAcknowledgment)
        throw new Error('Connection lost after commit');
      return response;
    })
  );
  const first = store();
  first.set('synthetic', content('new local code'));
  first.setActive(true);
  await vi.waitFor(() => expect(first.getSnapshot().status).toBe('failed'));
  first.setActive(false);
  fail = false;
  loseAcknowledgment = true;
  const reloaded = store();
  reloaded.setActive(true);
  await vi.waitFor(() => expect(reloaded.getSnapshot().status).toBe('failed'));
  expect(reloaded.getSnapshot().data.synthetic.lastCode).toBe('new local code');
  loseAcknowledgment = false;
  reloaded.retry();
  await vi.waitFor(() => expect(reloaded.getSnapshot().status).toBe('synced'));
  expect(database.prepare('SELECT attempts,last_code FROM user_drills').get()).toMatchObject({
    attempts: 1,
    last_code: 'new local code',
  });
  expect(database.prepare('SELECT COUNT(*) AS n FROM activity_log').get()?.n).toBe(1);
  expect(reloaded.getSnapshot().pending).toHaveLength(0);
});
it('serializes delayed writes and never lets an old GET or acknowledgment overwrite newer pending edits', async () => {
  let release;
  const delayed = new Promise((resolve) => {
    release = resolve;
  });
  let firstPost = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      const response = await network(url, init);
      if (init?.method === 'POST' && firstPost) {
        firstPost = false;
        await delayed;
      }
      return response;
    })
  );
  const current = store();
  current.set('synthetic', content('first'));
  current.setActive(true);
  await vi.waitFor(() => expect(firstPost).toBe(false));
  current.set('synthetic', content('second'));
  await current.reconcile();
  expect(current.getSnapshot().data.synthetic.lastCode).toBe('second');
  release();
  await vi.waitFor(() => expect(current.getSnapshot().status).toBe('synced'));
  expect(database.prepare('SELECT attempts,last_code FROM user_drills').get()).toMatchObject({
    attempts: 2,
    last_code: 'second',
  });
});
it('keeps accounts separate and refuses a pending Alice write under a Bob cookie', async () => {
  const alice = store();
  alice.set('synthetic', content('alice-only'));
  const bob = store('bob');
  expect(bob.getSnapshot().data).toEqual({});
  account = 'bob';
  alice.setActive(true);
  await vi.waitFor(() => expect(alice.getSnapshot().status).toBe('failed'));
  expect(database.prepare('SELECT COUNT(*) AS n FROM user_drills').get()?.n).toBe(0);
  alice.setActive(false);
  account = 'alice';
  alice.setActive(true);
  await vi.waitFor(() => expect(alice.getSnapshot().status).toBe('synced'));
  expect(database.prepare('SELECT user_id FROM user_drills').get()?.user_id).toBe('alice');
});
it.each([
  ['artifacts', { artifactId: 'a', status: 'done', notes: 'keep' }],
  ['projects', { projectId: 'p', status: 'active', nextAction: 'keep' }],
])(
  'deduplicates %s writes using the actual handler and receipt transaction',
  async (action, entry) => {
    const init = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...entry, operationId: 'same-operation', accountId: 'alice' }),
    };
    expect((await network(`/api/learning?action=${action}`, init)).status).toBe(200);
    expect((await network(`/api/learning?action=${action}`, init)).status).toBe(200);
    expect(database.prepare('SELECT COUNT(*) AS n FROM record_sync_receipts').get()?.n).toBe(1);
  }
);
it('keeps unsaved changes visible and does not POST until browser storage succeeds', async () => {
  const current = store();
  const save = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error('Quota exceeded');
  };
  current.set('synthetic', content('retain in memory'));
  current.setActive(true);
  await vi.waitFor(() => expect(current.getSnapshot().status).toBe('failed'));
  expect(current.getSnapshot().error).toContain('not saved in this browser');
  expect(database.prepare('SELECT COUNT(*) AS n FROM user_drills').get()?.n).toBe(0);
  expect(current.getSnapshot().data.synthetic.lastCode).toBe('retain in memory');
  localStorage.setItem = save;
  current.retry();
  await vi.waitFor(() => expect(current.getSnapshot().status).toBe('synced'));
  expect(database.prepare('SELECT attempts FROM user_drills').get()?.attempts).toBe(1);
});
it('ignores a stale GET released after the latest write has committed', async () => {
  let release;
  const delay = new Promise((resolve) => {
    release = resolve;
  });
  let delayGet = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      const response = await network(url, init);
      if (init?.method !== 'POST' && delayGet) {
        delayGet = false;
        await delay;
      }
      return response;
    })
  );
  const current = store();
  current.setActive(true);
  await vi.waitFor(() => expect(delayGet).toBe(false));
  current.set('synthetic', content('new code'));
  await current.flush();
  release();
  await vi.waitFor(() => expect(current.getSnapshot().status).toBe('synced'));
  expect(current.getSnapshot().data.synthetic.lastCode).toBe('new code');
  expect(database.prepare('SELECT attempts FROM user_drills').get()?.attempts).toBe(1);
});
it('rolls back the record and receipt together when the activity write fails', async () => {
  database.exec(
    "CREATE TRIGGER reject_activity BEFORE INSERT ON activity_log BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END"
  );
  const init = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      drillId: 'synthetic',
      ...content('atomic'),
      operationId: 'transaction',
      accountId: 'alice',
    }),
  };
  await expect(network('/api/learning?action=drills', init)).rejects.toThrow('synthetic failure');
  expect(database.prepare('SELECT COUNT(*) AS n FROM user_drills').get()?.n).toBe(0);
  expect(database.prepare('SELECT COUNT(*) AS n FROM record_sync_receipts').get()?.n).toBe(0);
  database.exec('DROP TRIGGER reject_activity');
  expect((await network('/api/learning?action=drills', init)).status).toBe(200);
  expect(database.prepare('SELECT attempts FROM user_drills').get()?.attempts).toBe(1);
});
