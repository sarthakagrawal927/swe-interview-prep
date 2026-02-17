import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  BookOpen,
  ExternalLink,
  FileCode2,
  Atom,
  Network,
  Image,
  Boxes,
  Terminal,
  Code2,
  Braces,
  Server,
  Binary,
  Layout as LayoutIcon,
} from 'lucide-react';
import { useLibrary } from '../hooks/useLibrary';
import type { RepoManifestEntry } from '../adapters/types';

const ICON_MAP: Record<string, typeof Code2> = {
  FileCode2,
  Atom,
  Network,
  Image,
  Boxes,
  Terminal,
  Code2,
  Braces,
  Server,
  Binary,
  Layout: LayoutIcon,
  BookOpen,
};

const TAG_COLORS: Record<string, string> = {
  javascript: 'bg-yellow-500/15 text-yellow-400',
  typescript: 'bg-blue-500/15 text-blue-400',
  react: 'bg-cyan-500/15 text-cyan-400',
  node: 'bg-green-500/15 text-green-400',
  python: 'bg-yellow-600/15 text-yellow-500',
  go: 'bg-sky-500/15 text-sky-400',
  rust: 'bg-orange-500/15 text-orange-400',
  system: 'bg-purple-500/15 text-purple-400',
  design: 'bg-pink-500/15 text-pink-400',
  algorithms: 'bg-emerald-500/15 text-emerald-400',
  interview: 'bg-indigo-500/15 text-indigo-400',
  css: 'bg-fuchsia-500/15 text-fuchsia-400',
  security: 'bg-red-500/15 text-red-400',
  devops: 'bg-teal-500/15 text-teal-400',
  database: 'bg-amber-500/15 text-amber-400',
};

function getTagColor(tag: string): string {
  const lower = tag.toLowerCase();
  for (const [key, cls] of Object.entries(TAG_COLORS)) {
    if (lower.includes(key)) return cls;
  }
  return 'bg-gray-700/50 text-gray-400';
}

function RepoCard({ repo }: { repo: RepoManifestEntry }) {
  const IconComponent = ICON_MAP[repo.icon] || BookOpen;

  return (
    <div className="group relative flex flex-col rounded-2xl border border-gray-800 bg-gray-900 p-5 transition-all hover:border-emerald-500/30 hover:bg-gray-800/80">
      <Link
        to={`/library/${repo.id}`}
        className="absolute inset-0 z-10 rounded-2xl"
        aria-label={`Open ${repo.name}`}
      />

      <div className="flex items-start justify-between mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
          <IconComponent className="h-5 w-5 text-emerald-400" />
        </div>
        <a
          href={repo.source}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-20 rounded-lg p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
          title="View on GitHub"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <h3 className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
        {repo.name}
      </h3>
      <p className="mt-1 text-sm text-gray-400 line-clamp-2 flex-1">
        {repo.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {repo.tags.slice(0, 4).map(tag => (
          <span
            key={tag}
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getTagColor(tag)}`}
          >
            {tag}
          </span>
        ))}
        {repo.tags.length > 4 && (
          <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-700/50 text-gray-500">
            +{repo.tags.length - 4}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 border-t border-gray-800 pt-3">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5" />
          {repo.sectionCount} sections
        </span>
        <span className="flex items-center gap-1">
          <FileCode2 className="h-3.5 w-3.5" />
          {repo.exerciseCount} exercises
        </span>
      </div>
    </div>
  );
}

export default function Library() {
  const { repos, search } = useLibrary();
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    repos.forEach(r => r.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [repos]);

  const filtered = useMemo(() => {
    let results = search(query);
    if (selectedTag) {
      results = results.filter(r => r.tags.includes(selectedTag));
    }
    return results;
  }, [query, selectedTag, search]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <BookOpen className="h-5 w-5 text-emerald-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Library</h1>
        </div>
        <p className="text-sm text-gray-400">
          Browse curated learning repos with interactive exercises
        </p>
      </div>

      {/* Search + Filters */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search repos by name, description, or tag..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-gray-900 py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedTag(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !selectedTag
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedTag === tag
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(repo => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800">
            <Search className="h-6 w-6 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">No repos found</p>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  );
}
