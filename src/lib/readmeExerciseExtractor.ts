import type { Exercise, Section } from '../adapters/types';
import { scoreExerciseQuality } from './questionQuality';

const SKIP_SECTION_TITLES =
  /^(contribut|code.of.conduct|license|changelog|security|funding|sponsors|backers|faq)$/i;

interface ExtractOptions {
  baseTags?: string[];
  maxExercises?: number;
  minScore?: number;
}

function flattenSections(sections: Section[], parentTitle = ''): Array<{
  title: string;
  content: string;
  path: string;
}> {
  const flat: Array<{ title: string; content: string; path: string }> = [];

  for (const section of sections) {
    const title = (section.title || '').trim();
    const path = parentTitle ? `${parentTitle} > ${title}` : title;
    if (section.content && section.content.trim().length > 0) {
      flat.push({
        title,
        content: section.content,
        path,
      });
    }
    if (section.children?.length) {
      flat.push(...flattenSections(section.children, path));
    }
  }

  return flat;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstGoodParagraph(raw: string): string {
  const withoutCode = raw.replace(/```[\s\S]*?```/g, '\n');
  const paragraphs = withoutCode
    .split(/\n{2,}/)
    .map(p => stripMarkdown(p))
    .filter(Boolean)
    .filter(p => p.length >= 40);

  const cleaned = paragraphs.filter(
    p => !/(back to top|table of contents|contributing|license)/i.test(p)
  );

  if (cleaned.length === 0) {
    return stripMarkdown(raw).slice(0, 360);
  }

  const [first, second] = cleaned;
  const summary = second ? `${first}\n\n${second}` : first;
  return summary.length > 700 ? `${summary.slice(0, 700)}...` : summary;
}

function normalizeTitle(title: string): string {
  return title
    .replace(/^\d+[\s.)-]*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureQuestionMark(text: string): string {
  return text.endsWith('?') ? text : `${text}?`;
}

function toQuestion(title: string, answer: string): string {
  const cleanTitle = normalizeTitle(title);
  const lowerTitle = cleanTitle.toLowerCase();
  const lowerAnswer = answer.toLowerCase();

  if (!cleanTitle) return 'What are the key ideas in this section?';
  if (cleanTitle.endsWith('?')) return cleanTitle;

  if (/^(what|why|how|when|where|which|can|does|do|is|are|should)\b/i.test(cleanTitle)) {
    return ensureQuestionMark(cleanTitle);
  }

  if (/\b(vs|versus|difference|compare)\b/i.test(lowerTitle)) {
    return `How do ${cleanTitle} differ, and when should each option be used?`;
  }

  if (/\b(setup|install|configuration|getting started)\b/i.test(lowerTitle)) {
    return `What are the critical setup steps for ${cleanTitle}, and what mistakes should be avoided?`;
  }

  if (/\btrade[- ]?off|pros and cons|advantages|disadvantages\b/i.test(lowerAnswer)) {
    return `What is ${cleanTitle}, and what trade-offs matter most in practice?`;
  }

  if (/\bsteps|workflow|process\b/i.test(lowerAnswer)) {
    return `What are the key steps in ${cleanTitle}, and why does each step matter?`;
  }

  return `What is ${cleanTitle}, why does it matter, and what is a common pitfall?`;
}

function inferDifficulty(text: string): Exercise['difficulty'] {
  const lower = text.toLowerCase();
  const hardHints = ['distributed', 'consensus', 'scalability', 'eventual consistency', 'advanced'];
  const mediumHints = ['tradeoff', 'pattern', 'architecture', 'lifecycle', 'optimization'];
  if (hardHints.some(h => lower.includes(h))) return 'hard';
  if (mediumHints.some(h => lower.includes(h))) return 'medium';
  return 'easy';
}

function deriveTags(baseTags: string[], title: string): string[] {
  const tags = new Set<string>(baseTags);
  const lower = title.toLowerCase();
  if (lower.includes('system')) tags.add('system-design');
  if (lower.includes('react')) tags.add('react');
  if (lower.includes('javascript')) tags.add('javascript');
  if (lower.includes('security')) tags.add('security');
  if (lower.includes('database')) tags.add('database');
  return Array.from(tags).slice(0, 6);
}

export function deriveExercisesFromSections(
  sections: Section[],
  options: ExtractOptions = {}
): Exercise[] {
  const baseTags = options.baseTags || [];
  const maxExercises = options.maxExercises || 80;
  const minScore = options.minScore ?? 68;
  const flatSections = flattenSections(sections);
  const generated: Exercise[] = [];

  for (const entry of flatSections) {
    if (generated.length >= maxExercises) break;
    if (SKIP_SECTION_TITLES.test(entry.title)) continue;
    if (entry.content.length < 250) continue;

    const answer = firstGoodParagraph(entry.content);
    if (!answer || answer.length < 60) continue;

    const exercise: Exercise = {
      id: `auto-${entry.path.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      type: 'qa',
      question: toQuestion(entry.title, answer),
      answer,
      difficulty: inferDifficulty(`${entry.title} ${answer}`),
      tags: deriveTags(baseTags, entry.title),
      sourceSection: entry.path,
    };

    const quality = scoreExerciseQuality(exercise);
    if (quality.score < minScore) continue;

    generated.push({
      ...exercise,
      qualityScore: quality.score,
      qualityTier: quality.tier,
      qualitySignals: quality.signals,
    });
  }

  const deduped = new Map<string, Exercise>();
  for (const exercise of generated) {
    const key = exercise.question.trim().toLowerCase();
    if (!deduped.has(key)) deduped.set(key, exercise);
  }

  return Array.from(deduped.values());
}
