// ─── Interview Categories ───────────────────────────────────────────────────

export type InterviewCategory = 'dsa' | 'lld' | 'hld' | 'behavioral';

export interface CategoryConfig {
  id: InterviewCategory;
  name: string;
  icon: string;
  description: string;
  color: string;
  hasCodeEditor: boolean;
  hasTestCases: boolean;
}

export const CATEGORIES: CategoryConfig[] = [
  { id: 'dsa', name: 'DSA', icon: 'Code2', description: 'Data Structures & Algorithms', color: 'blue', hasCodeEditor: true, hasTestCases: true },
  { id: 'lld', name: 'LLD', icon: 'Boxes', description: 'Low-Level Design / OOP', color: 'purple', hasCodeEditor: true, hasTestCases: false },
  { id: 'hld', name: 'HLD', icon: 'Network', description: 'System Design', color: 'orange', hasCodeEditor: false, hasTestCases: false },
  { id: 'behavioral', name: 'Behavioral', icon: 'Users', description: 'Behavioral Interviews', color: 'green', hasCodeEditor: false, hasTestCases: false },
];

export function getCategoryConfig(id: InterviewCategory): CategoryConfig {
  return CATEGORIES.find(c => c.id === id)!;
}

// ─── Core Types ─────────────────────────────────────────────────────────────

export interface Pattern {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface Step {
  title: string;
  hint?: string;
  approach?: string;
  code?: string;
  complexity?: string;
}

export interface TestCase {
  args: unknown[];
  expected: unknown;
  description: string;
}

export interface AnkiCard {
  id: string;
  front: string;
  back: string;
}

export interface MCQCard {
  id: string;
  problemId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface SimilarQuestion {
  title: string;
  titleSlug: string;
  difficulty: string;
}

// ─── Unified Problem Type ───────────────────────────────────────────────────
// Single type used across all categories. Category-specific fields are optional.

export interface Problem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  pattern: string;
  description: string;
  category?: InterviewCategory;
  steps: Step[];
  ankiCards: AnkiCard[];
  // DSA-specific
  leetcodeUrl?: string;
  leetcodeNumber?: number;
  starterCode?: string;
  testCases?: TestCase[];
  similarQuestions?: SimilarQuestion[];
  // LLD-specific
  requirements?: string[];
  keyClasses?: string[];
  designPatterns?: string[];
  solutionCode?: string;
  // HLD-specific
  keyComponents?: string[];
  concepts?: string[];
  // Behavioral-specific
  question?: string; // the interview question text
  assessing?: string;
  starHints?: { situation: string; task: string; action: string; result: string };
  tips?: string[];
}

// ─── Data container (shared across all categories) ──────────────────────────

export interface ProblemsData {
  patterns: Pattern[];
  problems: Problem[];
}

// ─── Progress / Review ──────────────────────────────────────────────────────

export interface ProgressEntry {
  status?: string;
  lastAttempted?: string;
  notes?: string;
  code?: string;
  language?: string;
  bookmarked?: boolean;
}

export interface Progress {
  [problemId: string]: ProgressEntry;
}

export interface ReviewData {
  [cardId: string]: {
    easeFactor: number;
    interval: number;
    repetitions: number;
    lastReview: string;
  };
}

export interface AnkiCardWithMeta extends AnkiCard {
  problemId: string;
  problemTitle: string;
  pattern: string;
}

export type Language = 'javascript' | 'typescript';
