import { Link } from 'react-router-dom';
import { useProblems } from '../hooks/useProblems';
import { useProgress } from '../hooks/useProgress';
import { useSpacedRepetition } from '../hooks/useSpacedRepetition';
import { useCategory } from '../contexts/CategoryContext';
import { getCategoryConfig } from '../types';
import {
  Trophy,
  Brain,
  Flame,
  Target,
  ArrowRight,
  CheckCircle2,
  Clock,
  BookOpen,
} from 'lucide-react';

export default function Dashboard() {
  const { category } = useCategory();
  const config = getCategoryConfig(category);
  const { patterns, problems, getPatternStats, getAllAnkiCards } = useProblems(category);
  const { getStats, getStatus } = useProgress();
  const { getReviewStats, getDueCards } = useSpacedRepetition();

  const stats = getStats();
  const reviewStats = getReviewStats();
  const allCards = getAllAnkiCards();
  const dueCards = getDueCards(allCards);

  const recentProblems = problems
    .slice(0, 5)
    .map(p => ({ ...p, status: getStatus(p.id) }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Welcome Section */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{config.name} Dashboard</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-400">
          {config.description} — track your progress and keep your streak going.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-6 sm:mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Trophy className="h-5 w-5 text-yellow-400" />}
          label="Problems Solved"
          value={stats.solved}
          sublabel={`of ${problems.length} total`}
          color="yellow"
        />
        <StatCard
          icon={<Brain className="h-5 w-5 text-purple-400" />}
          label="Cards Reviewed"
          value={reviewStats.totalReviewed}
          sublabel={`${dueCards.length} due today`}
          color="purple"
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-orange-400" />}
          label="Day Streak"
          value={reviewStats.streak}
          sublabel="Keep it going!"
          color="orange"
        />
        <StatCard
          icon={<Target className="h-5 w-5 text-green-400" />}
          label="Mastered"
          value={stats.mastered}
          sublabel={`${Math.round((stats.mastered / Math.max(problems.length, 1)) * 100)}% completion`}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
        {/* Patterns Quick Access */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-white">Patterns</h2>
            <Link
              to={`/${category}/patterns`}
              className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {patterns.slice(0, 6).map(pattern => {
              const patternStats = getPatternStats[pattern.id];
              const patternProblems = patternStats?.problems || [];
              const solvedCount = patternProblems.filter(
                p => getStatus(p.id) === 'solved' || getStatus(p.id) === 'mastered'
              ).length;

              return (
                <Link
                  key={pattern.id}
                  to={`/${category}/patterns`}
                  className="group rounded-xl border border-gray-800 bg-gray-900 p-3 sm:p-4 transition-all hover:border-gray-700 hover:bg-gray-800/80"
                >
                  <div className="mb-2 text-2xl">{pattern.icon}</div>
                  <div className="text-sm font-medium text-white group-hover:text-blue-400">
                    {pattern.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {solvedCount}/{patternStats?.total || 0} solved
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Start Review Card */}
          {dueCards.length > 0 && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400" />
                <h3 className="font-semibold text-white">Anki Review</h3>
              </div>
              <p className="mb-4 text-sm text-gray-300">
                You have <span className="font-bold text-purple-400">{dueCards.length}</span> cards
                due for review today.
              </p>
              <Link
                to={`/${category}/review`}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-600"
              >
                Start Review <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {/* Recent Problems */}
          <div>
            <h3 className="mb-3 text-lg font-semibold text-white">Problems</h3>
            <div className="space-y-2">
              {recentProblems.map(problem => (
                <Link
                  key={problem.id}
                  to={`/${category}/problem/${problem.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-3 sm:px-4 py-3 transition-all hover:border-gray-700 hover:bg-gray-800/80"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {problem.status === 'solved' || problem.status === 'mastered' ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />
                    ) : problem.status === 'attempted' ? (
                      <Clock className="h-4 w-4 flex-shrink-0 text-yellow-400" />
                    ) : (
                      <BookOpen className="h-4 w-4 flex-shrink-0 text-gray-500" />
                    )}
                    <span className="text-sm text-gray-200 truncate">{problem.title}</span>
                  </div>
                  <DifficultyBadge difficulty={problem.difficulty} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sublabel, color }) {
  const borderColors = {
    yellow: 'border-yellow-500/20',
    purple: 'border-purple-500/20',
    orange: 'border-orange-500/20',
    green: 'border-green-500/20',
  };

  return (
    <div
      className={`rounded-xl border ${borderColors[color]} bg-gray-900 p-3 sm:p-5`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs sm:text-sm text-gray-400 truncate">{label}</span>
      </div>
      <div className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-bold text-white">{value}</div>
      <div className="mt-0.5 sm:mt-1 text-xs text-gray-500">{sublabel}</div>
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
      className={`rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${colors[difficulty]}`}
    >
      {difficulty}
    </span>
  );
}
