import { useArtifactStore, useDrillStore, useProjectStore } from '../hooks/useUserStore';
import { retryRecordSync } from '../lib/recordSync';

export function RecordSyncStatus() {
  const stores = [useArtifactStore(), useDrillStore(), useProjectStore()];
  const failed = stores.find((store) => store.syncStatus === 'failed');
  const pending = stores.some((store) => store.syncStatus === 'pending');
  const local = stores.every((store) => store.syncStatus === 'local-only');
  const message =
    failed?.syncError ||
    (pending
      ? 'Learning edits pending account sync.'
      : local
        ? 'Drills, artifacts, and projects stay in this browser. Signing in opens separate account progress.'
        : 'Drill, artifact, and project edits synced to this account.');
  return (
    <div className="border-b border-white/10 px-4 py-2 text-xs text-white/60" role="status">
      {message}
      {failed && (
        <button type="button" className="ml-3 underline" onClick={retryRecordSync}>
          Retry sync
        </button>
      )}
    </div>
  );
}
