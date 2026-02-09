import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProblems } from '../hooks/useProblems';
import { useProgress } from '../hooks/useProgress';
import { useCategory } from '../contexts/CategoryContext';
import { getCategoryConfig } from '../types';
import {
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  BookOpen,
  ExternalLink,
} from 'lucide-react';

export default function Patterns() {
  const { category } = useCategory();
  const catConfig = getCategoryConfig(category);
  const { patterns, problems, getByPattern, search } = useProblems(category);
  const { getStatus } = useProgress();
  const [searchParams] = useSearchParams();
  const expandPattern = searchParams.get('pattern');
  const [query, setQuery] = useState('');
  const [expandedPatterns, setExpandedPatterns] = useState(() =>
    expandPattern ? { [expandPattern]: true } : {}
  );

  const togglePattern = (patternId) => {
    setExpandedPatterns(prev => ({
      ...prev,
      [patternId]: !prev[patternId],
    }));
  };

  const filteredProblems = query ? search(query) : null;

  // If searching, show a flat list grouped by pattern
  const filteredPatterns = query
    ? patterns.filter(p =>
        filteredProblems.some(prob => prob.pattern === p.id) ||
        p.name.toLowerCase().includes(query.toLowerCase())
      )
    : patterns;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{catConfig.name} Patterns</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-400">
          Master {catConfig.description.toLowerCase()} one pattern at a time.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6 sm:mb-8">
        <Search className="absolute left-3 sm:left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search patterns or problems..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-800 bg-gray-900 py-2.5 sm:py-3 pl-10 sm:pl-12 pr-4 text-sm sm:text-base text-gray-200 placeholder-gray-500 outline-none transition-colors focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
        />
      </div>

      {/* Pattern Grid */}
      <div className="space-y-3 sm:space-y-4">
        {filteredPatterns.map(pattern => {
          const patternProblems = query
            ? filteredProblems.filter(p => p.pattern === pattern.id)
            : getByPattern(pattern.id);
          const isExpanded = expandedPatterns[pattern.id] || (query && patternProblems.length > 0);
          const solvedCount = patternProblems.filter(
            p => getStatus(p.id) === 'solved' || getStatus(p.id) === 'mastered'
          ).length;
          const completionPct = patternProblems.length > 0
            ? Math.round((solvedCount / patternProblems.length) * 100)
            : 0;

          return (
            <div
              key={pattern.id}
              className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900"
            >
              {/* Pattern Header */}
              <button
                onClick={() => togglePattern(pattern.id)}
                className="flex w-full items-center justify-between p-4 sm:p-5 text-left transition-colors hover:bg-gray-800/50"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <span className="text-xl sm:text-2xl flex-shrink-0">{pattern.icon}</span>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                      {pattern.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-400 truncate">{pattern.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 ml-2">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium text-gray-300">
                      {solvedCount}/{patternProblems.length}
                    </div>
                    <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-gray-700">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right sm:hidden">
                    <div className="text-xs font-medium text-gray-300">
                      {solvedCount}/{patternProblems.length}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  )}
                </div>
              </button>

              {/* Expanded Problems List */}
              {isExpanded && patternProblems.length > 0 && (
                <div className="border-t border-gray-800">
                  {patternProblems.map((problem, idx) => {
                    const status = getStatus(problem.id);
                    return (
                      <Link
                        key={problem.id}
                        to={`/${category}/problem/${problem.id}`}
                        className={`flex items-center justify-between px-4 sm:px-5 py-3 transition-colors hover:bg-gray-800/50 ${
                          idx < patternProblems.length - 1
                            ? 'border-b border-gray-800/50'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          {status === 'solved' || status === 'mastered' ? (
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />
                          ) : status === 'attempted' ? (
                            <Clock className="h-4 w-4 flex-shrink-0 text-yellow-400" />
                          ) : (
                            <BookOpen className="h-4 w-4 flex-shrink-0 text-gray-500" />
                          )}
                          <span className="text-sm text-gray-200 truncate">
                            {problem.leetcodeNumber ? `${problem.leetcodeNumber}. ` : ''}{problem.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
                          <DifficultyBadge difficulty={problem.difficulty} />
                          <ExternalLink className="h-3.5 w-3.5 text-gray-600 hidden sm:block" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {isExpanded && patternProblems.length === 0 && (
                <div className="border-t border-gray-800 px-5 py-8 text-center text-sm text-gray-500">
                  No problems added yet for this pattern.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DifficultyBadge({ difficulty }) {
  const colors = {
    Easy: 'text-green-400 bg-green-400/10',
    Medium: 'text-yellow-400 bg-yellow-400/10',
    Hard: 'text-red-400 bg-red-400/10',
  };

  return (
    <span
      className={`rounded-full px-2 sm:px-2.5 py-0.5 text-xs font-medium ${colors[difficulty]}`}
    >
      {difficulty}
    </span>
  );
}
