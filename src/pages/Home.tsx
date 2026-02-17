import { Link } from 'react-router-dom';
import { Code2, Boxes, Network, Users, ArrowRight, BookOpen } from 'lucide-react';
import { CATEGORIES } from '../types';

const ICONS = { Code2, Boxes, Network, Users };

const COLOR_CLASSES = {
  blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400', hover: 'hover:border-blue-500/50' },
  purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400', hover: 'hover:border-purple-500/50' },
  orange: { border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-400', hover: 'hover:border-orange-500/50' },
  green: { border: 'border-green-500/30', bg: 'bg-green-500/10', text: 'text-green-400', hover: 'hover:border-green-500/50' },
};

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mb-8 sm:mb-12 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Interview Prep Studio</h1>
        <p className="mt-2 sm:mt-3 text-base sm:text-lg text-gray-400">
          Master every dimension of the technical interview.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
        {CATEGORIES.map(cat => {
          const Icon = ICONS[cat.icon as keyof typeof ICONS];
          const colors = COLOR_CLASSES[cat.color as keyof typeof COLOR_CLASSES];

          return (
            <Link
              key={cat.id}
              to={`/${cat.id}`}
              className={`group relative overflow-hidden rounded-2xl border ${colors.border} ${colors.hover} bg-gray-900 p-6 sm:p-8 transition-all hover:bg-gray-800/80`}
            >
              <div className={`mb-4 inline-flex rounded-xl ${colors.bg} p-3`}>
                {Icon && <Icon className={`h-6 w-6 sm:h-7 sm:w-7 ${colors.text}`} />}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">{cat.name}</h2>
              <p className="mt-1 text-sm text-gray-400">{cat.description}</p>
              <div className={`mt-4 flex items-center gap-1 text-sm font-medium ${colors.text}`}>
                Start practicing <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>

      <Link
        to="/library"
        className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 hover:border-emerald-500/50 bg-gray-900 p-6 sm:p-8 transition-all hover:bg-gray-800/80 mt-4 sm:mt-6"
      >
        <div className="mb-4 inline-flex rounded-xl bg-emerald-500/10 p-3">
          <BookOpen className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Library</h2>
        <p className="mt-1 text-sm text-gray-400">Browse curated learning repos with interactive exercises</p>
        <div className="mt-4 flex items-center gap-1 text-sm font-medium text-emerald-400">
          Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    </div>
  );
}
