import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Code2,
  Filter,
  RotateCcw,
  Shuffle,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useProblems } from '../hooks/useProblems';
import { useProgress } from '../hooks/useProgress';
import { useSpacedRepetition } from '../hooks/useSpacedRepetition';
import { MCQ_CARDS_BY_CATEGORY } from '../data/mcq-cards';
import type { MCQCard, Problem } from '../types';

const STORAGE_KEY = 'vibe-learning-session-v1';

type VibeKind = 'flashcard' | 'mcq' | 'solve';
type VibeCategory = 'dsa' | 'hld';
type Difficulty = 'Easy' | 'Medium' | 'Hard';
type QualityMode = 'high' | 'all';
type QualityTier = 'low' | 'medium' | 'high';

interface VibeFilters {
  kinds: VibeKind[];
  categories: VibeCategory[];
  pattern: string;
  difficulty: 'all' | Difficulty;
  dueOnly: boolean;
  quality: QualityMode;
}

interface PersistedSession {
  filters?: VibeFilters;
  queueIds?: string[];
  currentIndex?: number;
}

interface FlashcardSource {
  id: string;
  uniqueKey: string;
  cardId: string;
  front: string;
  back: string;
  category: VibeCategory;
  problemId: string;
  problemTitle: string;
  pattern: string;
  difficulty: Difficulty;
}

interface FlashcardItem {
  id: string;
  kind: 'flashcard';
  category: VibeCategory;
  problemId: string;
  problemTitle: string;
  pattern: string;
  difficulty: Difficulty;
  cardId: string;
  front: string;
  back: string;
  due: boolean;
  qualityScore: number;
  qualityTier: QualityTier;
}

interface MCQItem {
  id: string;
  kind: 'mcq';
  category: VibeCategory;
  problemId: string;
  problemTitle: string;
  pattern: string;
  difficulty: Difficulty;
  mcqId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  qualityScore: number;
  qualityTier: QualityTier;
}

interface SolveItem {
  id: string;
  kind: 'solve';
  category: VibeCategory;
  problemId: string;
  problemTitle: string;
  pattern: string;
  difficulty: Difficulty;
  description: string;
  qualityScore: number;
  qualityTier: QualityTier;
}

type VibeItem = FlashcardItem | MCQItem | SolveItem;

const DEFAULT_FILTERS: VibeFilters = {
  kinds: ['flashcard', 'mcq'],
  categories: ['dsa'],
  pattern: 'all',
  difficulty: 'all',
  dueOnly: false,
  quality: 'high',
};

const KIND_LABELS: Record<VibeKind, string> = {
  flashcard: 'Flashcards',
  mcq: 'Quiz',
  solve: 'Solve',
};

const CATEGORY_LABELS: Record<VibeCategory, string> = {
  dsa: 'DSA',
  hld: 'HLD',
};

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function normalizeDifficulty(input?: string): Difficulty {
  if (!input) return 'Medium';
  const raw = input.toLowerCase();
  if (raw.startsWith('easy')) return 'Easy';
  if (raw.startsWith('hard')) return 'Hard';
  return 'Medium';
}

function getQualityTier(score: number): QualityTier {
  if (score >= 75) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function scoreFlashcard(front: string, back: string): number {
  let score = 50;
  if (front.length >= 18 && front.length <= 200) score += 12;
  else score -= 10;
  if (back.length >= 80) score += 18;
  else if (back.length >= 50) score += 8;
  else score -= 14;
  if (back.includes('`') || back.includes(':') || /\n[-*]\s+/.test(back)) score += 8;
  if (back.endsWith('...')) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreMCQ(question: string, options: string[], explanation: string): number {
  let score = 50;
  const uniqueOptions = new Set(options.map(o => o.trim().toLowerCase()));
  if (question.length >= 24 && question.length <= 220) score += 12;
  else score -= 10;
  if (options.length === 4) score += 10;
  else if (options.length >= 3) score += 4;
  else score -= 14;
  if (uniqueOptions.size === options.length) score += 8;
  else score -= 10;
  if (explanation.length >= 70) score += 14;
  else if (explanation.length >= 40) score += 6;
  else score -= 12;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreSolve(description: string): number {
  let score = 55;
  if (description.length >= 180) score += 16;
  else if (description.length >= 100) score += 8;
  else score -= 10;
  if (description.includes('Example') || description.includes('Input')) score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function sanitizeFilters(input: VibeFilters): VibeFilters {
  const kinds = input.kinds.filter(k => ['flashcard', 'mcq', 'solve'].includes(k));
  const categories = input.categories.filter(c => ['dsa', 'hld'].includes(c));
  return {
    kinds: kinds.length > 0 ? kinds : DEFAULT_FILTERS.kinds,
    categories: categories.length > 0 ? categories : DEFAULT_FILTERS.categories,
    pattern: input.pattern || 'all',
    difficulty: input.difficulty || 'all',
    dueOnly: Boolean(input.dueOnly),
    quality: input.quality || 'high',
  };
}

function buildFlashcards(problems: Problem[], category: VibeCategory): FlashcardSource[] {
  const cards: FlashcardSource[] = [];
  for (const problem of problems) {
    for (const card of problem.ankiCards || []) {
      cards.push({
        id: card.id,
        uniqueKey: `${category}:${problem.id}:${card.id}`,
        cardId: card.id,
        front: card.front,
        back: card.back,
        category,
        problemId: problem.id,
        problemTitle: problem.title,
        pattern: problem.pattern,
        difficulty: normalizeDifficulty(problem.difficulty),
      });
    }
  }
  return cards;
}

function toggleValue<T extends string>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
}

export default function VibeLearning() {
  const dsa = useProblems('dsa');
  const hld = useProblems('hld');
  const { getDueCards, reviewCard } = useSpacedRepetition();
  const { updateStatus } = useProgress();

  const [filters, setFilters] = useState<VibeFilters>(DEFAULT_FILTERS);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const dsaProblems = dsa.problems;
  const hldProblems = hld.problems;

  const dsaProblemMap = useMemo(() => new Map(dsaProblems.map(p => [p.id, p])), [dsaProblems]);
  const hldProblemMap = useMemo(() => new Map(hldProblems.map(p => [p.id, p])), [hldProblems]);

  const flashcards = useMemo(
    () => [...buildFlashcards(dsaProblems, 'dsa'), ...buildFlashcards(hldProblems, 'hld')],
    [dsaProblems, hldProblems]
  );

  const dueCards = getDueCards(flashcards, Math.max(1000, flashcards.length + 5));
  const dueKeySet = useMemo(() => {
    const keys = new Set<string>();
    for (const card of dueCards as FlashcardSource[]) {
      keys.add(card.uniqueKey);
    }
    return keys;
  }, [dueCards]);

  const cardsByProblem = useMemo(() => {
    const map = new Map<string, FlashcardSource[]>();
    for (const card of flashcards) {
      const list = map.get(card.problemId) || [];
      list.push(card);
      map.set(card.problemId, list);
    }
    return map;
  }, [flashcards]);

  const patternNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const pattern of dsa.patterns) map.set(pattern.id, pattern.name);
    for (const pattern of hld.patterns) map.set(pattern.id, pattern.name);
    return map;
  }, [dsa.patterns, hld.patterns]);

  const availablePatternOptions = useMemo(() => {
    const selected = new Set(filters.categories);
    const entries: Array<{ id: string; name: string }> = [];
    const seen = new Set<string>();

    if (selected.has('dsa')) {
      for (const p of dsa.patterns) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          entries.push({ id: p.id, name: p.name });
        }
      }
    }

    if (selected.has('hld')) {
      for (const p of hld.patterns) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          entries.push({ id: p.id, name: p.name });
        }
      }
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [filters.categories, dsa.patterns, hld.patterns]);

  const flashcardItems = useMemo(() => {
    return flashcards.map<FlashcardItem>(card => {
      const qualityScore = scoreFlashcard(card.front, card.back);
      return {
        qualityScore,
        qualityTier: getQualityTier(qualityScore),
        id: `flashcard:${card.uniqueKey}`,
        kind: 'flashcard',
        category: card.category,
        problemId: card.problemId,
        problemTitle: card.problemTitle,
        pattern: card.pattern,
        difficulty: card.difficulty,
        cardId: card.cardId,
        front: card.front,
        back: card.back,
        due: dueKeySet.has(card.uniqueKey),
      };
    });
  }, [flashcards, dueKeySet]);

  const mcqItems = useMemo(() => {
    const items: MCQItem[] = [];
    const categoryMap: Record<VibeCategory, MCQCard[]> = {
      dsa: MCQ_CARDS_BY_CATEGORY.dsa || [],
      hld: MCQ_CARDS_BY_CATEGORY.hld || [],
    };

    for (const category of ['dsa', 'hld'] as VibeCategory[]) {
      const source = categoryMap[category];
      const problemMap = category === 'dsa' ? dsaProblemMap : hldProblemMap;
      for (const card of source) {
        const problem = problemMap.get(card.problemId);
        if (!problem) continue;
        const qualityScore = scoreMCQ(card.question, card.options, card.explanation);
        items.push({
          id: `mcq:${category}:${card.id}`,
          kind: 'mcq',
          category,
          problemId: card.problemId,
          problemTitle: problem.title,
          pattern: problem.pattern,
          difficulty: normalizeDifficulty(problem.difficulty),
          mcqId: card.id,
          question: card.question,
          options: card.options,
          correctIndex: card.correctIndex,
          explanation: card.explanation,
          qualityScore,
          qualityTier: getQualityTier(qualityScore),
        });
      }
    }

    return items;
  }, [dsaProblemMap, hldProblemMap]);

  const solveItems = useMemo(() => {
    const items: SolveItem[] = [];
    for (const problem of dsaProblems) {
      if ((problem.testCases || []).length === 0) continue;
      const description = problem.description || '';
      const qualityScore = scoreSolve(description);
      items.push({
        id: `solve:dsa:${problem.id}`,
        kind: 'solve',
        category: 'dsa',
        problemId: problem.id,
        problemTitle: problem.title,
        pattern: problem.pattern,
        difficulty: normalizeDifficulty(problem.difficulty),
        description,
        qualityScore,
        qualityTier: getQualityTier(qualityScore),
      });
    }
    return items;
  }, [dsaProblems]);

  const dueProblemSet = useMemo(() => {
    const set = new Set<string>();
    for (const card of flashcardItems) {
      if (card.due) set.add(card.problemId);
    }
    return set;
  }, [flashcardItems]);

  const filteredItems = useMemo(() => {
    const categorySet = new Set(filters.categories);
    const kindSet = new Set(filters.kinds);
    const items: VibeItem[] = [];

    if (kindSet.has('flashcard')) items.push(...flashcardItems);
    if (kindSet.has('mcq')) items.push(...mcqItems);
    if (kindSet.has('solve')) items.push(...solveItems);

    return items.filter(item => {
      if (!categorySet.has(item.category)) return false;
      if (filters.pattern !== 'all' && item.pattern !== filters.pattern) return false;
      if (filters.difficulty !== 'all' && item.difficulty !== filters.difficulty) return false;
      if (filters.quality === 'high' && item.qualityScore < 72) return false;
      if (filters.dueOnly && !dueProblemSet.has(item.problemId) && item.kind !== 'flashcard') return false;
      if (filters.dueOnly && item.kind === 'flashcard' && !item.due) return false;
      return true;
    });
  }, [filters, flashcardItems, mcqItems, solveItems, dueProblemSet]);

  const itemMap = useMemo(() => {
    return new Map(filteredItems.map(item => [item.id, item]));
  }, [filteredItems]);

  const queue = useMemo(() => {
    if (filteredItems.length === 0) return [];
    const seen = new Set<string>();
    const ordered: VibeItem[] = [];

    for (const id of queueIds) {
      const item = itemMap.get(id);
      if (item && !seen.has(id)) {
        ordered.push(item);
        seen.add(id);
      }
    }

    for (const item of filteredItems) {
      if (!seen.has(item.id)) {
        ordered.push(item);
        seen.add(item.id);
      }
    }

    return ordered;
  }, [queueIds, filteredItems, itemMap]);

  const currentItem = queue[currentIndex] || null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedSession;
        if (parsed.filters) setFilters(sanitizeFilters(parsed.filters));
        if (Array.isArray(parsed.queueIds)) {
          setQueueIds(parsed.queueIds.filter((v): v is string => typeof v === 'string'));
        }
        if (typeof parsed.currentIndex === 'number' && parsed.currentIndex >= 0) {
          setCurrentIndex(parsed.currentIndex);
        }
      }
    } catch {
      // Ignore corrupt session data and start fresh.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const validIds = new Set(filteredItems.map(item => item.id));
    const pruned = queueIds.filter(id => validIds.has(id));

    if (filteredItems.length === 0) {
      if (queueIds.length > 0) setQueueIds([]);
      if (currentIndex !== 0) setCurrentIndex(0);
      return;
    }

    if (pruned.length === 0) {
      setQueueIds(shuffleArray(filteredItems.map(item => item.id)));
      setCurrentIndex(0);
      return;
    }

    if (pruned.length !== queueIds.length) {
      setQueueIds(pruned);
    }

    if (currentIndex >= pruned.length) {
      setCurrentIndex(Math.max(pruned.length - 1, 0));
    }
  }, [hydrated, filteredItems, queueIds, currentIndex]);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedSession = {
      filters,
      queueIds: queue.map(item => item.id),
      currentIndex,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, filters, queue, currentIndex]);

  useEffect(() => {
    if (filters.pattern === 'all') return;
    if (availablePatternOptions.some(option => option.id === filters.pattern)) return;
    setFilters(prev => ({ ...prev, pattern: 'all' }));
  }, [filters.pattern, availablePatternOptions]);

  const resetRuntimeState = () => {
    setSelectedOption(null);
    setFlipped(false);
  };

  const advance = () => {
    if (queue.length === 0) return;
    resetRuntimeState();
    setCurrentIndex(prev => (prev + 1) % queue.length);
  };

  const goBack = () => {
    if (queue.length === 0) return;
    resetRuntimeState();
    setCurrentIndex(prev => (prev - 1 + queue.length) % queue.length);
  };

  const reshuffleQueue = () => {
    if (queue.length === 0) return;
    resetRuntimeState();
    setQueueIds(shuffleArray(queue.map(item => item.id)));
    setCurrentIndex(0);
  };

  const resetSession = () => {
    setFilters(DEFAULT_FILTERS);
    setQueueIds([]);
    setCurrentIndex(0);
    resetRuntimeState();
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateFilters = (next: Partial<VibeFilters>) => {
    setFilters(prev => sanitizeFilters({ ...prev, ...next }));
    setQueueIds([]);
    setCurrentIndex(0);
    resetRuntimeState();
  };

  const toggleKind = (kind: VibeKind) => {
    const nextKinds = toggleValue(filters.kinds, kind);
    if (nextKinds.length === 0) return;
    updateFilters({ kinds: nextKinds });
  };

  const toggleCategory = (category: VibeCategory) => {
    const nextCategories = toggleValue(filters.categories, category);
    if (nextCategories.length === 0) return;
    updateFilters({ categories: nextCategories });
  };

  const handleFlashcardReview = (item: FlashcardItem, quality: number) => {
    reviewCard(item.cardId, quality);
    advance();
  };

  const handleMCQNext = (item: MCQItem) => {
    if (selectedOption === null) return;
    const correct = selectedOption === item.correctIndex;
    const quality = correct ? 3 : 0;
    const relatedCards = cardsByProblem.get(item.problemId) || [];
    for (const card of relatedCards) {
      reviewCard(card.cardId, quality);
    }
    advance();
  };

  const handleSolveFeedback = (item: SolveItem, quality: number, status: 'attempted' | 'solved') => {
    const relatedCards = cardsByProblem.get(item.problemId) || [];
    for (const card of relatedCards) {
      reviewCard(card.cardId, quality);
    }
    updateStatus(item.problemId, status);
    advance();
  };

  const progress = queue.length > 0 ? ((currentIndex + 1) / queue.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-teal-400" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Vibe Learning</h1>
          <span className="rounded-full border border-teal-400/40 bg-teal-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
            Beta
          </span>
        </div>
        <p className="mt-2 text-sm sm:text-base text-gray-400">
          Short, flowy review sessions. Pick your question style, pause anytime, and resume exactly where you left off.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-300">
          <Filter className="h-4 w-4" />
          Filters
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Question Type</p>
            <div className="flex flex-wrap gap-2">
              {(['flashcard', 'mcq', 'solve'] as VibeKind[]).map(kind => {
                const active = filters.kinds.includes(kind);
                return (
                  <button
                    key={kind}
                    onClick={() => toggleKind(kind)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-teal-500/40 bg-teal-500/15 text-teal-300'
                        : 'border-gray-700 bg-gray-950 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                    }`}
                  >
                    {KIND_LABELS[kind]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Category</p>
            <div className="flex flex-wrap gap-2">
              {(['dsa', 'hld'] as VibeCategory[]).map(category => {
                const active = filters.categories.includes(category);
                return (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                        : 'border-gray-700 bg-gray-950 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                    }`}
                  >
                    {CATEGORY_LABELS[category]}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Pattern</p>
            <select
              value={filters.pattern}
              onChange={e => updateFilters({ pattern: e.target.value })}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:border-teal-500 focus:outline-none"
            >
              <option value="all">All patterns</option>
              {availablePatternOptions.map(pattern => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Difficulty</p>
            <select
              value={filters.difficulty}
              onChange={e => updateFilters({ difficulty: e.target.value as VibeFilters['difficulty'] })}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:border-teal-500 focus:outline-none"
            >
              <option value="all">All difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </label>

          <label className="block">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Quality</p>
            <select
              value={filters.quality}
              onChange={e => updateFilters({ quality: e.target.value as QualityMode })}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:border-teal-500 focus:outline-none"
            >
              <option value="high">High signal only</option>
              <option value="all">All items</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => updateFilters({ dueOnly: !filters.dueOnly })}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              filters.dueOnly
                ? 'border-purple-500/40 bg-purple-500/15 text-purple-300'
                : 'border-gray-700 bg-gray-950 text-gray-400 hover:border-gray-600 hover:text-gray-200'
            }`}
          >
            Due-first only
          </button>

          <button
            onClick={reshuffleQueue}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-600 hover:text-white"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Reshuffle
          </button>

          <button
            onClick={resetSession}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-600 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Session
          </button>
        </div>
      </div>

      {currentItem ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-400">
              {currentIndex + 1} / {queue.length}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge>{KIND_LABELS[currentItem.kind]}</Badge>
              <Badge>{CATEGORY_LABELS[currentItem.category]}</Badge>
              <Badge>{currentItem.difficulty}</Badge>
              <Badge>Quality {currentItem.qualityScore}</Badge>
              <Badge>{patternNameMap.get(currentItem.pattern) || currentItem.pattern}</Badge>
            </div>
          </div>

          <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-teal-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            {currentItem.kind === 'flashcard' && (
              <>
                <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Flashcard</div>
                <h2 className="text-lg font-semibold text-white">{currentItem.problemTitle}</h2>
                <p className="mt-4 whitespace-pre-wrap text-gray-200">
                  {flipped ? currentItem.back : currentItem.front}
                </p>
                <p className="mt-3 text-xs text-gray-500">
                  {currentItem.due ? 'Due now' : 'Not due yet'}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setFlipped(v => !v)}
                    className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-600 hover:text-white"
                  >
                    {flipped ? 'Show Front' : 'Flip Card'}
                  </button>

                  {flipped && (
                    <>
                      <button
                        onClick={() => handleFlashcardReview(currentItem, 0)}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/20"
                      >
                        Again
                      </button>
                      <button
                        onClick={() => handleFlashcardReview(currentItem, 1)}
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-500/20"
                      >
                        Hard
                      </button>
                      <button
                        onClick={() => handleFlashcardReview(currentItem, 2)}
                        className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-300 hover:bg-sky-500/20"
                      >
                        Good
                      </button>
                      <button
                        onClick={() => handleFlashcardReview(currentItem, 3)}
                        className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-sm text-green-300 hover:bg-green-500/20"
                      >
                        Easy
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {currentItem.kind === 'mcq' && (
              <>
                <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Quiz</div>
                <h2 className="text-lg font-semibold text-white">{currentItem.question}</h2>

                <div className="mt-5 space-y-2">
                  {currentItem.options.map((option, idx) => {
                    const isChosen = selectedOption === idx;
                    const isCorrect = idx === currentItem.correctIndex;
                    const showResult = selectedOption !== null;
                    return (
                      <button
                        key={option}
                        onClick={() => {
                          if (selectedOption === null) setSelectedOption(idx);
                        }}
                        className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                          !showResult
                            ? 'border-gray-700 bg-gray-950 text-gray-200 hover:border-gray-600'
                            : isCorrect
                            ? 'border-green-500/30 bg-green-500/10 text-green-200'
                            : isChosen
                            ? 'border-red-500/30 bg-red-500/10 text-red-200'
                            : 'border-gray-800 bg-gray-950 text-gray-500'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                {selectedOption !== null && (
                  <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950 p-4">
                    <p className="text-sm text-gray-300">{currentItem.explanation}</p>
                    <button
                      onClick={() => handleMCQNext(currentItem)}
                      className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}

            {currentItem.kind === 'solve' && (
              <>
                <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Solve</div>
                <h2 className="text-lg font-semibold text-white">{currentItem.problemTitle}</h2>
                <p className="mt-3 text-sm text-gray-300">
                  {currentItem.description.replace(/```[\s\S]*?```/g, '').replace(/\*\*/g, '').slice(0, 360)}
                  {currentItem.description.length > 360 ? '...' : ''}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Link
                    to={`/${currentItem.category}/problem/${currentItem.problemId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-sm text-blue-300 hover:bg-blue-500/20"
                  >
                    <Code2 className="h-4 w-4" />
                    Open Problem
                  </Link>

                  <button
                    onClick={() => handleSolveFeedback(currentItem, 1, 'attempted')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-500/20"
                  >
                    <CircleDashed className="h-4 w-4" />
                    Need Work
                  </button>

                  <button
                    onClick={() => handleSolveFeedback(currentItem, 3, 'solved')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-sm text-green-300 hover:bg-green-500/20"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    I Know This
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={goBack}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-600 hover:text-white"
            >
              Previous
            </button>
            <button
              onClick={advance}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-600 hover:text-white"
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-gray-600" />
          <h2 className="mt-3 text-lg font-semibold text-white">No items for this filter</h2>
          <p className="mt-2 text-sm text-gray-400">
            Try enabling more question types, categories, or turn off due-first mode.
          </p>
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5 text-gray-300">
      {children}
    </span>
  );
}
