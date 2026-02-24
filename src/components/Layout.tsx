import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { LayoutDashboard, Grid3X3, Brain, PlusCircle, Code2, LogOut, LogIn, Home, Boxes, Network, Users, BookOpen, FlaskConical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, getCategoryConfig } from '../types';
import type { InterviewCategory } from '../types';

const CATEGORY_ICONS: Record<string, typeof Code2> = { Code2, Boxes, Network, Users };

export default function Layout() {
  const location = useLocation();
  const params = useParams();
  const { user, isGuest, signInWithGoogle, signOut } = useAuth();

  // Detect if we're inside a category route
  const categoryId = params['*']?.split('/')[0] || '';
  const isInCategory = ['dsa', 'lld', 'hld', 'behavioral'].includes(categoryId);
  const activeCategory = isInCategory ? getCategoryConfig(categoryId as InterviewCategory) : null;
  const basePath = activeCategory ? `/${activeCategory.id}` : '';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-500/20 text-blue-400'
        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
    }`;

  const bottomTabClass = (path: string) => {
    const isActive = path === basePath
      ? location.pathname === basePath || location.pathname === basePath + '/'
      : location.pathname.startsWith(path);
    return `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
      isActive ? 'text-blue-400' : 'text-gray-500'
    }`;
  };

  return (
    <div className="min-h-screen bg-gray-950 pb-16 md:pb-0 overflow-x-hidden max-w-full">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between">
            {/* Left: Logo + Category indicator */}
            <div className="flex items-center gap-2 sm:gap-3">
              <NavLink to="/" className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-blue-500/20">
                  <Code2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                </div>
                <span className="hidden sm:inline text-lg font-bold text-white">
                  {activeCategory ? activeCategory.name + ' Prep' : 'Interview Prep'}
                </span>
              </NavLink>

              {/* Category switcher pills */}
              {activeCategory && (
                <div className="hidden lg:flex items-center gap-1 ml-2 border-l border-gray-800 pl-3">
                  {CATEGORIES.map(cat => {
                    const CatIcon = CATEGORY_ICONS[cat.icon];
                    const isActive = cat.id === activeCategory.id;
                    return (
                      <NavLink
                        key={cat.id}
                        to={`/${cat.id}`}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                        }`}
                        title={cat.description}
                      >
                        {CatIcon && <CatIcon className="h-3.5 w-3.5" />}
                        {cat.name}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Middle: Section nav (only when in a category) */}
            {activeCategory && (
              <div className="hidden md:flex items-center gap-1">
                <NavLink to={basePath} end className={linkClass}>
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </NavLink>
                <NavLink to={`${basePath}/patterns`} className={linkClass}>
                  <Grid3X3 className="h-4 w-4" />
                  {activeCategory.id === 'behavioral' ? 'Categories' : 'Patterns'}
                </NavLink>
                {(activeCategory.id === 'dsa' || activeCategory.id === 'hld') && (
                  <NavLink to={`${basePath}/review`} className={linkClass}>
                    <Brain className="h-4 w-4" />
                    Review
                  </NavLink>
                )}
                <NavLink to={`${basePath}/import`} className={linkClass}>
                  <PlusCircle className="h-4 w-4" />
                  Import
                </NavLink>
              </div>
            )}

            {/* Right: Home button (when in category) + User */}
            <div className="flex items-center gap-2 sm:gap-3">
              {activeCategory && (
                <NavLink
                  to="/"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">All Topics</span>
                </NavLink>
              )}

              {/* Tablet compact nav */}
              {activeCategory && (
                <div className="flex md:hidden items-center gap-1">
                  <NavLink to={basePath} end className={linkClass}>
                    <LayoutDashboard className="h-4 w-4" />
                  </NavLink>
                  <NavLink to={`${basePath}/patterns`} className={linkClass}>
                    <Grid3X3 className="h-4 w-4" />
                  </NavLink>
                  {(activeCategory.id === 'dsa' || activeCategory.id === 'hld') && (
                    <NavLink to={`${basePath}/review`} className={linkClass}>
                      <Brain className="h-4 w-4" />
                    </NavLink>
                  )}
                  <NavLink to={`${basePath}/import`} className={linkClass}>
                    <PlusCircle className="h-4 w-4" />
                  </NavLink>
                </div>
              )}

              <NavLink
                to="/library"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`
                }
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Library</span>
              </NavLink>

              <NavLink
                to="/playground"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive ? 'bg-violet-500/20 text-violet-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`
                }
              >
                <FlaskConical className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Playground</span>
              </NavLink>

              {/* User info */}
              <div className="flex items-center gap-2 border-l border-gray-800 pl-2 sm:pl-3">
                {user ? (
                  <>
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="" className="h-7 w-7 rounded-full" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-400">
                        {(user.email?.[0] || '?').toUpperCase()}
                      </div>
                    )}
                    <span className="hidden lg:inline max-w-[120px] truncate text-sm text-gray-300">
                      {user.user_metadata?.full_name || user.email}
                    </span>
                    <button onClick={signOut} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200" title="Sign out">
                      <LogOut className="h-4 w-4" />
                    </button>
                  </>
                ) : isGuest ? (
                  <button onClick={signInWithGoogle} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200">
                    <LogIn className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Sign in</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <Outlet />
      </main>

      {/* Bottom Tab Bar - mobile only (only in category view) */}
      {activeCategory && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-800 bg-gray-950/95 backdrop-blur-xl md:hidden">
          <NavLink to="/" className={bottomTabClass('__home__')}>
            <Home className="h-5 w-5" />
            <span>Home</span>
          </NavLink>
          <NavLink to={basePath} end className={bottomTabClass(basePath)}>
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to={`${basePath}/patterns`} className={bottomTabClass(`${basePath}/patterns`)}>
            <Grid3X3 className="h-5 w-5" />
            <span>Patterns</span>
          </NavLink>
          {(activeCategory.id === 'dsa' || activeCategory.id === 'hld') && (
            <NavLink to={`${basePath}/review`} className={bottomTabClass(`${basePath}/review`)}>
              <Brain className="h-5 w-5" />
              <span>Review</span>
            </NavLink>
          )}
          <NavLink to={`${basePath}/import`} className={bottomTabClass(`${basePath}/import`)}>
            <PlusCircle className="h-5 w-5" />
            <span>Import</span>
          </NavLink>
        </div>
      )}
    </div>
  );
}
