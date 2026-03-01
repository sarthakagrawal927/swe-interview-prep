import { useState, useMemo } from 'react';
import { RotateCcw, CheckCircle2, XCircle, ChevronRight, Shuffle } from 'lucide-react';
import type { Exercise } from '../adapters/types';
import { scoreExerciseQuality } from '../lib/questionQuality';

interface ExerciseRunnerProps {
  exercises: Exercise[];
  repoName: string;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function ExerciseRunner({ exercises, repoName }: ExerciseRunnerProps) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [shuffled, setShuffled] = useState(false);
  const [tagFilter, setTagFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState<'high' | 'all'>('high');
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const scoredExercises = useMemo(() => {
    return exercises.map(exercise => {
      if (exercise.qualityScore !== undefined && exercise.qualityTier) return exercise;
      const quality = scoreExerciseQuality(exercise);
      return {
        ...exercise,
        qualityScore: quality.score,
        qualityTier: quality.tier,
        qualitySignals: quality.signals,
      };
    });
  }, [exercises]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    exercises.forEach(e => e.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [exercises]);

  const filtered = useMemo(() => {
    let list = tagFilter === 'all'
      ? scoredExercises
      : scoredExercises.filter(e => e.tags.includes(tagFilter));

    if (qualityFilter === 'high') {
      list = list.filter(e => (e.qualityScore || 0) >= 72 || e.qualityTier === 'high');
    }

    const ordered = [...list].sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
    return shuffled ? shuffleArray(ordered) : ordered;
  }, [scoredExercises, tagFilter, qualityFilter, shuffled]);

  const current = filtered[index];

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-gray-400 mb-4">
          {exercises.length === 0 ? 'No exercises available for this repo yet.' : 'No exercises match your filter.'}
        </p>
      </div>
    );
  }

  const handleNext = () => {
    setRevealed(false);
    setSelectedOption(null);
    setIndex(i => (i + 1) % filtered.length);
  };

  const handleMCQSelect = (optionIdx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIdx);
    const isCorrect = current.options && current.options[optionIdx] === current.answer;
    setScore(s => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
    }));
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {index + 1} / {filtered.length}
          </span>
          {score.total > 0 && (
            <span className="text-sm text-gray-500">
              Score: {score.correct}/{score.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-700 bg-gray-900 p-0.5">
            <button
              onClick={() => { setQualityFilter('high'); setIndex(0); }}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                qualityFilter === 'high'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              High signal
            </button>
            <button
              onClick={() => { setQualityFilter('all'); setIndex(0); }}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                qualityFilter === 'all'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              All
            </button>
          </div>

          {allTags.length > 1 && (
            <select
              value={tagFilter}
              onChange={e => { setTagFilter(e.target.value); setIndex(0); }}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300"
            >
              <option value="all">All tags</option>
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          )}
          <button
            onClick={() => { setShuffled(!shuffled); setIndex(0); }}
            className={`rounded-lg p-2 transition-colors ${shuffled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
            title="Shuffle"
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setIndex(0); setScore({ correct: 0, total: 0 }); setRevealed(false); setSelectedOption(null); }}
            className="rounded-lg bg-gray-800 p-2 text-gray-400 hover:text-gray-200 transition-colors"
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Exercise Card */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
        {/* Question */}
        <div className="mb-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {current.difficulty && (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                current.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' :
                current.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {current.difficulty}
              </span>
            )}
            {current.qualityScore !== undefined && (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                current.qualityTier === 'high'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : current.qualityTier === 'medium'
                  ? 'bg-sky-500/10 text-sky-400'
                  : 'bg-gray-700/60 text-gray-400'
              }`}>
                Quality {current.qualityScore}
              </span>
            )}
          </div>
          <p className="text-lg text-gray-200 whitespace-pre-wrap">{current.question}</p>
        </div>

        {/* MCQ Options */}
        {current.type === 'mcq' && current.options ? (
          <div className="space-y-2 mb-6">
            {current.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              const isCorrect = opt === current.answer;
              const showResult = selectedOption !== null;

              return (
                <button
                  key={i}
                  onClick={() => handleMCQSelect(i)}
                  disabled={selectedOption !== null}
                  className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                    showResult && isCorrect
                      ? 'border-green-500/50 bg-green-500/10 text-green-300'
                      : showResult && isSelected && !isCorrect
                      ? 'border-red-500/50 bg-red-500/10 text-red-300'
                      : isSelected
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-400" />}
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Q&A / Flashcard — Reveal Button */}
        {(current.type === 'qa' || current.type === 'flashcard') && !revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="w-full rounded-xl border border-gray-700 bg-gray-800 py-3 text-sm font-medium text-gray-300 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
          >
            Show Answer
          </button>
        )}

        {/* Answer */}
        {(revealed || (current.type === 'mcq' && selectedOption !== null)) && (
          <div className="mt-4 rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Answer</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{current.answer}</p>
          </div>
        )}
      </div>

      {/* Next Button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleNext}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
