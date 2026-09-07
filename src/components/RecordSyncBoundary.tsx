import { useLayoutEffect, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { activateRecordAccount, retryRecordSync } from '../lib/recordSync';

export function RecordSyncBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  useLayoutEffect(() => {
    activateRecordAccount(loading ? null : (user?.id ?? null));
    window.addEventListener('online', retryRecordSync);
    return () => {
      activateRecordAccount(null);
      window.removeEventListener('online', retryRecordSync);
    };
  }, [user?.id, loading]);
  return (
    <div key={user?.id ?? 'guest'} className="contents">
      {children}
    </div>
  );
}
