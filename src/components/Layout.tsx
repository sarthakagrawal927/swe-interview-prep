import { LogOut, Settings } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { focusedRoute } from '../lib/focusedRoute';
import { recordRecentVisit } from '../lib/recentVisits';
import { STORE_KEYS, loadLocal } from '../lib/userStore';
import { SiteHeader } from './SiteHeader';
import { RecordSyncStatus } from './RecordSyncStatus';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

// SettingsModal imports ImportAndNotifySettings + LearningProfileSettings,
// which read the full learning catalogue. Defer it from the initial shell.
const SettingsModal = lazy(() => import('./SettingsModal'));

export default function Layout() {
  const location = useLocation();
  const { user, isGuest, signOut } = useAuth();
  const focus = focusedRoute(location.pathname);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    recordRecentVisit(location.pathname, location.search);
  }, [location.pathname, location.search]);
  /**
   * Warn about local-only storage once there is something to lose.
   *
   * Shown to a blank first visit it is noise stacked on two other strips, and
   * it is not even true yet — nothing is at risk. Once a guest has rated
   * concepts, it is the most useful thing on the page.
   */
  const guestHasProgress =
    isGuest &&
    (Object.keys(loadLocal<Record<string, unknown>>(STORE_KEYS.mastery, {})).length > 0 ||
      Object.keys(loadLocal<Record<string, unknown>>(STORE_KEYS.sweep, {})).length > 0);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="min-h-screen bg-black">
        <SiteHeader
          focus={focus ?? undefined}
          actions={
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSettingsOpen(true)}
                    aria-label="Settings"
                    className="flex h-11 w-11 items-center justify-center rounded-md text-white/50 transition-colors duration-150 hover:bg-white/5 hover:text-white"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Settings</TooltipContent>
              </Tooltip>
              {user ? (
                <>
                  {(user as any).picture ? (
                    <img
                      src={(user as any).picture}
                      alt=""
                      className="ml-1 h-8 w-8 rounded-full ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-xs font-medium text-white/80 ring-1 ring-white/10">
                      {((user as any).email?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={signOut}
                        aria-label="Sign out"
                        className="flex h-11 w-11 items-center justify-center rounded-md text-white/50 transition-colors duration-150 hover:bg-white/5 hover:text-white"
                      >
                        <LogOut className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Sign out</TooltipContent>
                  </Tooltip>
                </>
              ) : isGuest ? (
                <Link
                  to="/login#sign-in"
                  className="ml-1 inline-flex h-11 items-center rounded-md border border-white/10 px-3 text-xs font-medium text-white/65 transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50"
                >
                  Sign in
                </Link>
              ) : null}
            </>
          }
        />

        {/* Nothing here requires an account. The one thing signing in buys is
            progress that outlives the browser — say that plainly, because a
            guest who sweeps 250 concepts and then clears their storage loses
            all of it silently. */}
        {!focus && guestHasProgress && (
          <div className="border-b border-white/[0.06] bg-white/[0.02]">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-6">
              <p className="text-xs text-white/55">
                Your progress is saved in this browser only — clearing it loses everything.
              </p>
              <span className="font-mono text-[11px] text-white/50">
                Sign in from the header to keep it.
              </span>
            </div>
          </div>
        )}

        <RecordSyncStatus />
        <main id="main-content" className="min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>

        {!focus && (
          <footer className="border-t border-white/[0.08]">
            <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 py-8 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:px-6">
              <div>
                <p className="font-medium text-white/75">SWE Interview Prep</p>
                <p className="mt-2 max-w-2xl leading-6 text-white/45">
                  Personal, maintenance-only learning software for turning interview study into
                  retained, artifact-backed understanding. No paid tier or checkout.
                </p>
              </div>
              <nav aria-label="Product information" className="flex flex-wrap gap-x-5 gap-y-3">
                <Link to="/login" className="text-white/50 hover:text-white">
                  How it works
                </Link>
                <a href="/curriculum/" className="text-white/50 hover:text-white">
                  Curriculum
                </a>
                <Link to="/changelog" className="text-white/50 hover:text-white">
                  Changelog
                </Link>
                <Link to="/privacy" className="text-white/50 hover:text-white">
                  Privacy
                </Link>
              </nav>
            </div>
          </footer>
        )}

        <Suspense fallback={null}>
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Suspense>
      </div>
    </TooltipProvider>
  );
}
