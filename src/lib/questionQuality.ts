import type { Exercise } from '../adapters/types';

export interface QuestionQuality {
  score: number;
  tier: 'low' | 'medium' | 'high';
  signals: string[];
}

const QUESTION_STARTERS = /^(what|why|how|when|where|which|explain|describe|compare)\b/i;
const VAGUE_QUESTION = /\b(stuff|thing|common operations|overview)\b/i;
const NOISE_ANSWER = /(lorem ipsum|todo|tbd)/i;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getQualityTier(score: number): QuestionQuality['tier'] {
  if (score >= 75) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

export function scoreExerciseQuality(exercise: Exercise): QuestionQuality {
  let score = 50;
  const signals: string[] = [];
  const question = (exercise.question || '').trim();
  const answer = (exercise.answer || '').trim();

  if (question.length >= 18 && question.length <= 180) {
    score += 12;
    signals.push('clear-question-length');
  } else {
    score -= 12;
    signals.push('question-length-issue');
  }

  if (QUESTION_STARTERS.test(question) || question.includes('?')) {
    score += 6;
    signals.push('clear-prompt');
  } else {
    score -= 4;
    signals.push('prompt-not-explicit');
  }

  if (VAGUE_QUESTION.test(question)) {
    score -= 8;
    signals.push('vague-wording');
  }

  if (answer.length >= 120) {
    score += 16;
    signals.push('substantive-answer');
  } else if (answer.length >= 60) {
    score += 9;
    signals.push('adequate-answer');
  } else if (answer.length < 30) {
    score -= 18;
    signals.push('answer-too-short');
  } else {
    score -= 8;
    signals.push('answer-light');
  }

  if (answer.includes('```') || /\n[-*]\s+/.test(answer) || /\d+\.\s+/.test(answer)) {
    score += 6;
    signals.push('structured-answer');
  }

  if (answer.endsWith('...')) {
    score -= 10;
    signals.push('truncated-answer');
  }

  if (NOISE_ANSWER.test(answer)) {
    score -= 12;
    signals.push('noisy-answer');
  }

  if (exercise.type === 'mcq') {
    const options = exercise.options || [];
    const uniqueOptions = new Set(options.map(o => o.trim().toLowerCase()));
    if (options.length >= 3 && options.length <= 5) {
      score += 8;
      signals.push('mcq-option-count-good');
    } else {
      score -= 14;
      signals.push('mcq-option-count-bad');
    }
    if (uniqueOptions.size === options.length) {
      score += 7;
      signals.push('mcq-options-unique');
    } else {
      score -= 10;
      signals.push('mcq-duplicate-options');
    }
  }

  const finalScore = clamp(Math.round(score), 0, 100);
  return {
    score: finalScore,
    tier: getQualityTier(finalScore),
    signals,
  };
}
