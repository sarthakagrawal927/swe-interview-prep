// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { RecordSyncBoundary } from './RecordSyncBoundary';
import { RecordSyncStatus } from './RecordSyncStatus';
import { useDrillStore } from '../hooks/useUserStore';

const auth = vi.hoisted(() => ({
  user: { id: 'status-alice' } as { id: string } | null,
  loading: false,
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

function Editor() {
  const store = useDrillStore();
  return (
    <>
      <span>{store.getDrill('synthetic').lastCode}</span>
      <button
        onClick={() =>
          store.setDrill('synthetic', {
            status: 'solved',
            lastCode: 'private Alice draft',
            attempts: 0,
          })
        }
      >
        Save result
      </button>
    </>
  );
}

afterEach(() => vi.unstubAllGlobals());

it('shows failed/pending/synced state, retries on reconnect, and remounts private drafts on account changes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  let fail = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (_url, init) =>
        new Response(JSON.stringify({ drills: {}, artifacts: {}, projects: {} }), {
          status: init?.method === 'POST' && fail ? 503 : 200,
        })
    )
  );
  const element = document.createElement('div');
  const root = createRoot(element);
  const view = () => (
    <RecordSyncBoundary>
      <RecordSyncStatus />
      <Editor />
    </RecordSyncBoundary>
  );
  try {
    await act(async () => root.render(view()));
    await act(async () => element.querySelector('button')!.click());
    expect(element.textContent).toContain('pending account sync');
    await act(async () => new Promise((resolve) => setTimeout(resolve, 550)));
    expect(element.textContent).toContain('account sync failed');
    expect(element.textContent).toContain('Retry sync');
    fail = false;
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(element.textContent).toContain('edits synced to this account');
    auth.user = { id: 'status-bob' };
    await act(async () => root.render(view()));
    expect(element.textContent).not.toContain('private Alice draft');
    auth.user = null;
    await act(async () => root.render(view()));
    expect(element.textContent).toContain('stay in this browser');
    expect(element.textContent).not.toContain('private Alice draft');
  } finally {
    await act(async () => root.unmount());
  }
});
