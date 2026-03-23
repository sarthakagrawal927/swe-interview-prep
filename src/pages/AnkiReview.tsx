import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CodeEditor from '../components/CodeEditor';
import { useProblems } from '../hooks/useProblems';
import { useSpacedRepetition } from '../hooks/useSpacedRepetition';
import { useCodeExecution } from '../hooks/useCodeExecution';
import { useProgress } from '../hooks/useProgress';
import { useCategory } from '../contexts/CategoryContext';
import { MCQ_CARDS_BY_CATEGORY } from '../data/mcq-cards';
import type { MCQCard, Problem, Language } from '../types';
import {
  RotateCcw,
  Brain,
  CheckCircle2,
  XCircle,
  Filter,
  ChevronDown,
  Sparkles,
  Shuffle,
  ListChecks,
  Code2,
  Play,
  Loader2,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';

type ReviewMode = 'mcq' | 'flashcard' | 'solve';

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function AnkiReview() {
  const { category } = useCategory();
  const { getAllAnkiCards, patterns, getById } = useProblems(category);
  const { getDueCards, reviewCard, getReviewStats } = useSpacedRepetition();

  // Categories with review: DSA (solve + MCQ), HLD (MCQ only)
  const hasReview = category === 'dsa' || category === 'hld';
  const hasSolve = category === 'dsa';
  const categoryMCQ = MCQ_CARDS_BY_CATEGORY[category] || [];

  const allFlashcards = getAllAnkiCards();
  const [patternFilter, setPatternFilter] = useState('all');
  const [showFilter, setShowFilter] = useState(false);
  const [mode, setMode] = useState<ReviewMode>(hasSolve ? 'mcq' : 'mcq');

  // Flashcard state (kept for spaced repetition tracking)
  const filteredFlashcards = useMemo(() => {
    if (patternFilter === 'all') return allFlashcards;
    return allFlashcards.filter(c => c.pattern === patternFilter);
  }, [allFlashcards, patternFilter]);

  const dueCards = getDueCards(filteredFlashcards);
  const [fcIndex, setFcIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // MCQ state
  const filteredMCQ = useMemo(() => {
    if (patternFilter === 'all') return categoryMCQ;
    const problemIds = new Set(
      allFlashcards.filter(c => c.pattern === patternFilter).map(c => c.problemId)
    );
    return categoryMCQ.filter(c => problemIds.has(c.problemId));
  }, [patternFilter, allFlashcards, categoryMCQ]);

  const [shuffledMCQ, setShuffledMCQ] = useState<MCQCard[]>([]);
  const [mcqIndex, setMcqIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  // Solve mode state
  const solveProblems = useMemo(() => {
    // Get unique problems from due flashcards
    const seen = new Set<string>();
    const problems: Problem[] = [];
    for (const card of dueCards) {
      if (!seen.has(card.problemId)) {
        seen.add(card.problemId);
        const p = getById(card.problemId);
        if (p && (p.testCases || []).length > 0) problems.push(p);
      }
    }
    // Also include problems from all filtered flashcards if no due cards
    if (problems.length === 0) {
      for (const card of filteredFlashcards) {
        if (!seen.has(card.problemId)) {
          seen.add(card.problemId);
          const p = getById(card.problemId);
          if (p && (p.testCases || []).length > 0) problems.push(p);
        }
      }
    }
    return shuffleArray(problems);
  }, [dueCards, filteredFlashcards, getById]);

  const [solveIndex, setSolveIndex] = useState(0);

  // Shared
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

  // Shuffle MCQ on mount and filter change
  useEffect(() => {
    setShuffledMCQ(shuffleArray(filteredMCQ));
    setMcqIndex(0);
    setSelectedOption(null);
    setShowExplanation(false);
    setScore({ correct: 0, total: 0 });
    setReviewedCount(0);
    setSessionComplete(false);
  }, [filteredMCQ]);

  const reviewStats = getReviewStats();
  const currentFlashcard = dueCards[fcIndex] || null;
  const currentMCQ = shuffledMCQ[mcqIndex] || null;
  const currentSolveProblem = solveProblems[solveIndex] || null;

  const totalCards = mode === 'mcq' ? shuffledMCQ.length : mode === 'flashcard' ? dueCards.length : solveProblems.length;

  const handleFlip = () => setIsFlipped(!isFlipped);

  const handleFlashcardReview = useCallback((quality: number) => {
    if (!currentFlashcard) return;
    reviewCard(currentFlashcard.id, quality);
    setReviewedCount(prev => prev + 1);
    setIsFlipped(false);
    if (fcIndex + 1 >= dueCards.length) {
      setSessionComplete(true);
    } else {
      setFcIndex(prev => prev + 1);
    }
  }, [currentFlashcard, fcIndex, dueCards.length, reviewCard]);

  const handleMCQSelect = (idx: number) => {
    if (selectedOption !== null) return; // already answered
    setSelectedOption(idx);
    setShowExplanation(true);
    const isCorrect = idx === currentMCQ.correctIndex;
    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
  };

  const handleMCQNext = () => {
    setReviewedCount(prev => prev + 1);
    setSelectedOption(null);
    setShowExplanation(false);
    if (mcqIndex + 1 >= shuffledMCQ.length) {
      setSessionComplete(true);
    } else {
      setMcqIndex(prev => prev + 1);
    }
  };

  const handleSolveNext = useCallback((quality: number) => {
    // Review all anki cards for this problem
    if (currentSolveProblem) {
      const cards = allFlashcards.filter(c => c.problemId === currentSolveProblem.id);
      for (const card of cards) {
        reviewCard(card.id, quality);
      }
    }
    setReviewedCount(prev => prev + 1);
    if (solveIndex + 1 >= solveProblems.length) {
      setSessionComplete(true);
    } else {
      setSolveIndex(prev => prev + 1);
    }
  }, [currentSolveProblem, solveIndex, solveProblems.length, reviewCard, allFlashcards]);

  const handleRestart = () => {
    setFcIndex(0);
    setIsFlipped(false);
    setMcqIndex(0);
    setSolveIndex(0);
    setSelectedOption(null);
    setShowExplanation(false);
    setScore({ correct: 0, total: 0 });
    setReviewedCount(0);
    setSessionComplete(false);
    if (mode === 'mcq') {
      setShuffledMCQ(shuffleArray(filteredMCQ));
    }
  };

  const handleReshuffle = () => {
    setShuffledMCQ(shuffleArray(filteredMCQ));
    setMcqIndex(0);
    setSelectedOption(null);
    setShowExplanation(false);
    setScore({ correct: 0, total: 0 });
    setReviewedCount(0);
    setSessionComplete(false);
  };

  // No review for LLD and Behavioral
  if (!hasReview) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        <Link
          to={`/${category}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 sm:p-12 text-center">
          <Brain className="mx-auto mb-4 h-10 w-10 sm:h-12 sm:w-12 text-gray-600" />
          <h2 className="text-lg sm:text-xl font-semibold text-white">Review not available</h2>
          <p className="mt-2 text-sm sm:text-base text-gray-400">
            Spaced repetition review is not available for this category yet. Check out the patterns and problems instead.
          </p>
          <Link
            to={`/${category}/patterns`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            View Patterns
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      <Link
        to={`/${category}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {mode === 'mcq' ? 'Quiz Mode' : mode === 'flashcard' ? 'Flashcard Review' : 'Solve Mode'}
          </h1>
          <p className="mt-1 text-sm sm:text-base text-gray-400">
            {mode === 'mcq'
              ? 'Test your understanding with multiple choice questions.'
              : mode === 'flashcard'
              ? 'Spaced repetition flashcards to reinforce your learning.'
              : 'Solve problems from scratch to test your recall.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mode Toggle - only show if more than one mode */}
          {hasSolve && (
            <div className="flex items-center gap-1 rounded-lg bg-gray-800 p-0.5">
              <button
                onClick={() => { setMode('mcq'); handleRestart(); }}
                className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'mcq' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <ListChecks className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Quiz</span>
              </button>
              <button
                onClick={() => { setMode('solve'); handleRestart(); }}
                className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'solve' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Solve</span>
              </button>
            </div>
          )}
          {/* Filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-2 text-xs sm:text-sm text-gray-300 transition-colors hover:bg-gray-800"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">
                {patternFilter === 'all' ? 'All' : patterns.find(p => p.id === patternFilter)?.name}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {showFilter && (
              <div className="absolute right-0 z-10 mt-2 w-56 max-h-80 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
                <button
                  onClick={() => { setPatternFilter('all'); setShowFilter(false); handleRestart(); }}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-gray-800 ${
                    patternFilter === 'all' ? 'text-blue-400' : 'text-gray-300'
                  }`}
                >
                  All Patterns
                </button>
                {patterns.map(p => {
                  const count = allFlashcards.filter(c => c.pattern === p.id).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setPatternFilter(p.id); setShowFilter(false); handleRestart(); }}
                      className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-gray-800 ${
                        patternFilter === p.id ? 'text-blue-400' : 'text-gray-300'
                      }`}
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-gray-500">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-bold text-white">{totalCards}</div>
          <div className="text-xs text-gray-500">{mode === 'mcq' ? 'Questions' : mode === 'solve' ? 'Problems' : 'Due Today'}</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-bold text-white">{reviewedCount}</div>
          <div className="text-xs text-gray-500">Completed</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 sm:p-4 text-center">
          <div className="text-xl sm:text-2xl font-bold text-white">
            {mode === 'mcq'
              ? (score.total > 0 ? `${Math.round((score.correct / score.total) * 100)}%` : '-')
              : reviewStats.streak}
          </div>
          <div className="text-xs text-gray-500">{mode === 'mcq' ? 'Accuracy' : 'Day Streak'}</div>
        </div>
      </div>

      {/* Progress Bar */}
      {totalCards > 0 && (
        <div className="mb-6 sm:mb-8">
          <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
            <span>{reviewedCount} completed</span>
            <div className="flex items-center gap-2">
              {mode === 'mcq' && (
                <button onClick={handleReshuffle} className="flex items-center gap-1 text-purple-400 hover:text-purple-300">
                  <Shuffle className="h-3 w-3" />
                  Reshuffle
                </button>
              )}
              <span>{totalCards} total</span>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                mode === 'mcq' ? 'bg-purple-500' : mode === 'solve' ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min((reviewedCount / totalCards) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Content Area */}
      {sessionComplete ? (
        <SessionComplete
          reviewedCount={reviewedCount}
          score={mode === 'mcq' ? score : undefined}
          onRestart={handleRestart}
          mode={mode}
        />
      ) : mode === 'mcq' ? (
        shuffledMCQ.length === 0 ? (
          <EmptyState mode="mcq" />
        ) : currentMCQ ? (
          <MCQCardView
            card={currentMCQ}
            index={mcqIndex}
            total={shuffledMCQ.length}
            selectedOption={selectedOption}
            showExplanation={showExplanation}
            onSelect={handleMCQSelect}
            onNext={handleMCQNext}
          />
        ) : null
      ) : mode === 'solve' ? (
        solveProblems.length === 0 ? (
          <EmptyState mode="solve" />
        ) : currentSolveProblem ? (
          <SolveCardView
            problem={currentSolveProblem}
            index={solveIndex}
            total={solveProblems.length}
            onNext={handleSolveNext}
          />
        ) : null
      ) : null}
    </div>
  );
}

function SolveCardView({
  problem, index, total, onNext,
}: {
  problem: Problem; index: number; total: number;
  onNext: (quality: number) => void;
}) {
  const { category } = useCategory();
  const { execute, output, errors, testResults, isRunning, clearOutput } = useCodeExecution();
  const { updateStatus, getStatus } = useProgress();
  const [code, setCode] = useState((problem.starterCode || ''));
  const [language, setLanguage] = useState<Language>('typescript');
  const [hasRun, setHasRun] = useState(false);
  const [allPassed, setAllPassed] = useState(false);

  // Reset when problem changes
  useEffect(() => {
    setCode((problem.starterCode || ''));
    setHasRun(false);
    setAllPassed(false);
    clearOutput();
  }, [problem.id]);

  const handleRun = async () => {
    if (isRunning) return;
    const status = getStatus(problem.id);
    if (status === 'unseen') {
      updateStatus(problem.id, 'attempted');
    }
    const result = await execute(code, problem.testCases || [], language);
    setHasRun(true);
    const passed = result.testResults.length > 0 && result.testResults.every(t => t.passed);
    setAllPassed(passed);
    if (passed) {
      updateStatus(problem.id, 'solved');
    }
  };

  const diffColors: Record<string, string> = {
    Easy: 'text-green-400 bg-green-400/10',
    Medium: 'text-yellow-400 bg-yellow-400/10',
    Hard: 'text-red-400 bg-red-400/10',
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Problem {index + 1} of {total}</span>
          <span className="text-gray-700">|</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${diffColors[problem.difficulty] || ''}`}>
            {problem.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {problem.leetcodeUrl && (
            <a
              href={problem.leetcodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
            >
              <ExternalLink className="h-3 w-3" />
              LeetCode
            </a>
          )}
          <button
            onClick={() => {
              updateStatus(problem.id, 'solved');
              onNext(3); // Easy quality — already know it
            }}
            className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/20"
          >
            <CheckCircle2 className="h-3 w-3" />
            Mark Done
          </button>
        </div>
      </div>

      {/* Problem title and description */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-800">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
            {problem.leetcodeNumber ? `${problem.leetcodeNumber}. ` : ''}{problem.title}
          </h3>
          {problem.description && (
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed line-clamp-4">
              {problem.description.replace(/```[\s\S]*?```/g, '').replace(/\*\*/g, '').slice(0, 300)}
              {problem.description.length > 300 ? '...' : ''}
            </p>
          )}
          <Link
            to={`/${category}/problem/${problem.id}`}
            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            View full problem
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Code Editor */}
        <div className="border-b border-gray-800">
          <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md bg-gray-800 p-0.5">
                <button
                  onClick={() => setLanguage('javascript')}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    language === 'javascript' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  JS
                </button>
                <button
                  onClick={() => setLanguage('typescript')}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    language === 'typescript' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  TS
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCode((problem.starterCode || '')); clearOutput(); setHasRun(false); setAllPassed(false); }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Run
              </button>
            </div>
          </div>
          <div className="h-[250px] sm:h-[300px]">
            <CodeEditor
              code={code}
              language={language}
              onChange={(v) => setCode(v || '')}
              onRun={handleRun}
              fontSize={13}
            />
          </div>
        </div>

        {/* Test Results */}
        <div className="p-4">
          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running tests...
            </div>
          )}

          {errors && (
            <pre className="whitespace-pre-wrap rounded-lg bg-red-500/10 p-3 font-mono text-xs text-red-400 mb-3">
              {errors}
            </pre>
          )}

          {output && (
            <pre className="whitespace-pre-wrap rounded-lg bg-gray-950 p-3 font-mono text-xs text-gray-300 mb-3">
              {output}
            </pre>
          )}

          {testResults.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400">Test Results</span>
                <span className={`text-xs font-medium ${
                  testResults.every(t => t.passed) ? 'text-green-400' : 'text-red-400'
                }`}>
                  {testResults.filter(t => t.passed).length}/{testResults.length} passed
                </span>
              </div>
              {testResults.map((tc, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-2.5 ${
                    tc.passed
                      ? 'border-green-500/20 bg-green-500/5'
                      : 'border-red-500/20 bg-red-500/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {tc.passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-400" />
                    )}
                    <span className="text-xs text-gray-300">{tc.description || `Test ${idx + 1}`}</span>
                  </div>
                  {!tc.passed && (
                    <div className="mt-1 ml-5.5 space-y-0.5 font-mono text-xs">
                      <div className="text-gray-500">Expected: <span className="text-gray-300">{JSON.stringify(tc.expected)}</span></div>
                      <div className="text-red-400">Actual: {tc.error || JSON.stringify(tc.actual)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!hasRun && !isRunning && (
            <div className="text-center py-4 text-sm text-gray-600">
              Write your solution and click Run to test it.
            </div>
          )}
        </div>
      </div>

      {/* Review Quality Buttons - show after running */}
      {hasRun && !isRunning && (
        <div className="mt-4">
          {allPassed ? (
            <div className="mb-3 flex items-center justify-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              All tests passed! How did it feel?
            </div>
          ) : (
            <div className="mb-3 text-center text-sm text-gray-400">
              Rate your recall to continue:
            </div>
          )}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <ReviewButton label="Again" sublabel="Couldn't do it" color="red" onClick={() => onNext(0)} />
            <ReviewButton label="Hard" sublabel="Struggled" color="yellow" onClick={() => onNext(1)} />
            <ReviewButton label="Good" sublabel="Got it" color="blue" onClick={() => onNext(2)} />
            <ReviewButton label="Easy" sublabel="No problem" color="green" onClick={() => onNext(3)} />
          </div>
          <button
            onClick={() => onNext(allPassed ? 2 : 0)}
            className="mt-2 w-full rounded-xl border border-gray-800 py-2 text-xs text-gray-500 transition-colors hover:bg-gray-900 hover:text-gray-300"
          >
            Skip rating
          </button>
        </div>
      )}
    </div>
  );
}

function MCQCardView({
  card, index, total, selectedOption, showExplanation, onSelect, onNext,
}: {
  card: MCQCard; index: number; total: number;
  selectedOption: number | null; showExplanation: boolean;
  onSelect: (idx: number) => void; onNext: () => void;
}) {
  const diffColors = {
    easy: 'text-green-400 bg-green-400/10',
    medium: 'text-yellow-400 bg-yellow-400/10',
    hard: 'text-red-400 bg-red-400/10',
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-gray-500">Q {index + 1} of {total}</span>
        <span className="text-gray-700">|</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${diffColors[card.difficulty]}`}>
          {card.difficulty}
        </span>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-8">
        <p className="text-base sm:text-lg font-medium text-white leading-relaxed mb-6">
          {card.question}
        </p>

        <div className="space-y-3">
          {card.options.map((option, idx) => {
            let optionStyle = 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800 cursor-pointer';
            if (selectedOption !== null) {
              if (idx === card.correctIndex) {
                optionStyle = 'border-green-500/50 bg-green-500/10';
              } else if (idx === selectedOption && idx !== card.correctIndex) {
                optionStyle = 'border-red-500/50 bg-red-500/10';
              } else {
                optionStyle = 'border-gray-800 bg-gray-900/50 opacity-50';
              }
            }

            return (
              <button
                key={idx}
                onClick={() => onSelect(idx)}
                disabled={selectedOption !== null}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 sm:p-4 text-left transition-all ${optionStyle}`}
              >
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                  selectedOption !== null && idx === card.correctIndex
                    ? 'border-green-500 bg-green-500 text-white'
                    : selectedOption === idx && idx !== card.correctIndex
                      ? 'border-red-500 bg-red-500 text-white'
                      : 'border-gray-600 text-gray-400'
                }`}>
                  {selectedOption !== null && idx === card.correctIndex ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : selectedOption === idx && idx !== card.correctIndex ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    String.fromCharCode(65 + idx)
                  )}
                </span>
                <span className={`text-sm leading-relaxed ${
                  selectedOption !== null && idx === card.correctIndex ? 'text-green-300' :
                  selectedOption === idx && idx !== card.correctIndex ? 'text-red-300' :
                  'text-gray-300'
                }`}>
                  {option}
                </span>
              </button>
            );
          })}
        </div>

        {showExplanation && (
          <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-2">Explanation</p>
            <p className="text-sm leading-relaxed text-gray-300">{card.explanation}</p>
          </div>
        )}
      </div>

      {selectedOption !== null && (
        <button
          onClick={onNext}
          className="mt-4 w-full rounded-xl bg-purple-600 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          {index + 1 >= total ? 'Finish' : 'Next Question'}
        </button>
      )}
    </div>
  );
}

function FlashcardView({
  card, index, total, isFlipped, onFlip, onReview,
}: {
  card: any; index: number; total: number;
  isFlipped: boolean; onFlip: () => void; onReview: (q: number) => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-gray-500">Card {index + 1} of {total}</span>
        <span className="text-gray-700">|</span>
        <span className="text-gray-500 truncate">{card.problemTitle}</span>
      </div>

      <div
        onClick={!isFlipped ? onFlip : undefined}
        className={`relative min-h-[240px] sm:min-h-[300px] w-full cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 ${
          isFlipped
            ? 'border-blue-500/30 bg-blue-500/5'
            : 'border-gray-800 bg-gray-900 hover:border-gray-700'
        }`}
      >
        <div className="flex min-h-[240px] sm:min-h-[300px] flex-col items-center justify-center p-5 sm:p-8 text-center">
          {!isFlipped ? (
            <>
              <Brain className="mb-4 h-7 w-7 sm:h-8 sm:w-8 text-gray-600" />
              <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
                {card.front}
              </p>
              <p className="mt-4 sm:mt-6 text-sm text-gray-500">Click to reveal answer</p>
            </>
          ) : (
            <div className="whitespace-pre-wrap text-left text-sm leading-relaxed text-gray-200 w-full">
              {card.back}
            </div>
          )}
        </div>
      </div>

      {isFlipped && (
        <div className="mt-4 sm:mt-6 grid grid-cols-4 gap-2 sm:gap-3">
          <ReviewButton label="Again" sublabel="< 1 min" color="red" onClick={() => onReview(0)} />
          <ReviewButton label="Hard" sublabel="< 6 min" color="yellow" onClick={() => onReview(1)} />
          <ReviewButton label="Good" sublabel="< 10 min" color="blue" onClick={() => onReview(2)} />
          <ReviewButton label="Easy" sublabel="4 days" color="green" onClick={() => onReview(3)} />
        </div>
      )}
    </div>
  );
}

function ReviewButton({ label, sublabel, color, onClick }: {
  label: string; sublabel: string; color: string; onClick: () => void;
}) {
  const colors: Record<string, string> = {
    red: 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20',
    green: 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20',
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-2 sm:p-3 text-center transition-colors ${colors[color]}`}
    >
      <div className="text-xs sm:text-sm font-semibold">{label}</div>
      <div className="mt-0.5 text-[10px] sm:text-xs opacity-60">{sublabel}</div>
    </button>
  );
}

function SessionComplete({ reviewedCount, score, onRestart, mode }: {
  reviewedCount: number; score?: { correct: number; total: number }; onRestart: () => void; mode: ReviewMode;
}) {
  const accuracy = score ? Math.round((score.correct / score.total) * 100) : 0;
  const isGreat = !score || accuracy >= 70;

  return (
    <div className={`rounded-2xl border p-8 sm:p-12 text-center ${
      isGreat ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'
    }`}>
      <Sparkles className={`mx-auto mb-4 h-10 w-10 sm:h-12 sm:w-12 ${isGreat ? 'text-green-400' : 'text-yellow-400'}`} />
      <h2 className="text-xl sm:text-2xl font-bold text-white">
        {mode === 'mcq' ? 'Quiz Complete!' : mode === 'solve' ? 'Solve Session Complete!' : 'Session Complete!'}
      </h2>
      {score && (
        <div className="mt-4 flex items-center justify-center gap-6">
          <div>
            <div className="text-3xl font-bold text-white">{accuracy}%</div>
            <div className="text-xs text-gray-500">Accuracy</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-400">{score.correct}</div>
            <div className="text-xs text-gray-500">Correct</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-red-400">{score.total - score.correct}</div>
            <div className="text-xs text-gray-500">Wrong</div>
          </div>
        </div>
      )}
      <p className="mt-4 text-sm sm:text-base text-gray-400">
        You {mode === 'mcq' ? 'answered' : mode === 'solve' ? 'solved' : 'reviewed'} <span className="font-semibold text-green-400">{reviewedCount}</span> {mode === 'mcq' ? 'questions' : mode === 'solve' ? 'problems' : 'cards'}.
        {isGreat ? ' Great work!' : ' Keep practicing!'}
      </p>
      <button
        onClick={onRestart}
        className={`mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors ${
          mode === 'mcq' ? 'bg-purple-600 hover:bg-purple-700' : mode === 'solve' ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        <RotateCcw className="h-4 w-4" />
        {mode === 'mcq' ? 'Retake Quiz' : mode === 'solve' ? 'Solve Again' : 'Review Again'}
      </button>
    </div>
  );
}

function EmptyState({ mode }: { mode: ReviewMode }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 sm:p-12 text-center">
      <CheckCircle2 className="mx-auto mb-4 h-10 w-10 sm:h-12 sm:w-12 text-gray-600" />
      <h2 className="text-lg sm:text-xl font-semibold text-white">
        {mode === 'mcq' ? 'No quiz questions available' : mode === 'solve' ? 'No problems to solve' : 'All caught up!'}
      </h2>
      <p className="mt-2 text-sm sm:text-base text-gray-400">
        {mode === 'mcq'
          ? 'No MCQ questions found for this filter. Try selecting a different pattern.'
          : mode === 'solve'
          ? 'No problems with test cases available for this filter. Import some problems first!'
          : 'No cards are due for review right now. Come back later or solve more problems.'}
      </p>
    </div>
  );
}
