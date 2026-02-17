import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Dumbbell,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { useLibrary, useRepoContent } from '../hooks/useLibrary';
import SectionTree from '../components/SectionTree';
import MarkdownViewer from '../components/MarkdownViewer';
import ExerciseRunner from '../components/ExerciseRunner';
import type { Section } from '../adapters/types';

const SKIP_TITLES = /^(contribut|code.of.conduct|license|changelog|security|funding|backers|sponsors)/i;

function findFirstContentSection(sections: Section[]): Section | null {
  // First pass: find a meaningful section (skip boilerplate)
  for (const s of sections) {
    if (s.content && !SKIP_TITLES.test(s.title)) return s;
    if (s.children) {
      const found = findFirstContentSection(s.children);
      if (found) return found;
    }
  }
  // Fallback: return any section with content
  for (const s of sections) {
    if (s.content) return s;
    if (s.children) {
      const found = findFirstContentSection(s.children);
      if (found) return found;
    }
  }
  return null;
}

type Mode = 'read' | 'practice';

export default function RepoView() {
  const { repoSlug } = useParams<{ repoSlug: string }>();
  const { getRepo } = useLibrary();
  const repo = repoSlug ? getRepo(repoSlug) : null;
  const { content, loading, error } = useRepoContent(repoSlug || '');

  const [mode, setMode] = useState<Mode>('read');
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-select first content section once loaded
  useEffect(() => {
    if (!loading && content.sections.length > 0 && !activeSection) {
      const first = findFirstContentSection(content.sections);
      if (first) setActiveSection(first);
    }
  }, [loading, content.sections, activeSection]);

  // Not found
  if (!repo) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800">
          <BookOpen className="h-6 w-6 text-gray-600" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Repo not found</h2>
        <p className="text-sm text-gray-400 mb-6">
          The repository you&apos;re looking for doesn&apos;t exist in the library.
        </p>
        <Link
          to="/library"
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </Link>
      </div>
    );
  }

  const hasExercises = content.exercises.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-3 sm:px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            to="/library"
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors flex-shrink-0"
            title="Back to Library"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm sm:text-base font-semibold text-white truncate">
            {repo.name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex items-center rounded-lg border border-gray-700 bg-gray-900 p-0.5">
            <button
              onClick={() => setMode('read')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                mode === 'read'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Read</span>
            </button>
            <div className="relative">
              <button
                onClick={() => hasExercises && setMode('practice')}
                disabled={!hasExercises}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'practice'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : hasExercises
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-600 cursor-not-allowed'
                }`}
                title={!hasExercises ? 'No exercises available for this repo' : 'Practice exercises'}
              >
                <Dumbbell className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Practice</span>
              </button>
            </div>
          </div>

          {/* GitHub Link */}
          <a
            href={repo.source}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            title="View on GitHub"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          {/* Mobile sidebar toggle */}
          {mode === 'read' && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors md:hidden"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-emerald-400" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
          <p className="text-red-400 font-medium mb-2">Failed to load content</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      ) : mode === 'practice' ? (
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <ExerciseRunner exercises={content.exercises} repoName={repo.name} />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden relative">
          {/* Sidebar - Desktop */}
          <aside className="hidden md:flex w-64 lg:w-72 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-950">
            <div className="px-3 py-3 border-b border-gray-800">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sections
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              <SectionTree
                sections={content.sections}
                activeSectionId={activeSection?.id || null}
                onSelect={s => setActiveSection(s)}
              />
            </div>
          </aside>

          {/* Sidebar - Mobile overlay */}
          {sidebarOpen && (
            <>
              <div
                className="fixed inset-0 z-30 bg-black/50 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <aside className="fixed left-0 top-0 bottom-0 z-40 w-72 flex flex-col bg-gray-950 border-r border-gray-800 md:hidden">
                <div className="flex items-center justify-between px-3 py-3 border-b border-gray-800">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sections
                  </p>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="rounded-lg p-1 text-gray-400 hover:text-gray-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-2">
                  <SectionTree
                    sections={content.sections}
                    activeSectionId={activeSection?.id || null}
                    onSelect={s => {
                      setActiveSection(s);
                      setSidebarOpen(false);
                    }}
                  />
                </div>
              </aside>
            </>
          )}

          {/* Main content */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:px-12">
            {activeSection?.content ? (
              <MarkdownViewer content={activeSection.content} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-8 w-8 text-gray-600 mb-3" />
                <p className="text-gray-400">Select a section to start reading</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
