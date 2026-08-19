import type { GradedQuestion, Question, ResponseMap, Test, TestResult } from '../types';

/**
 * Lowercase, drop punctuation/accents, collapse whitespace and strip a leading
 * article so "The T. rex" and "t rex" grade the same.
 */
export function normalize(text: string): string {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base.replace(/^(a|an|the)\s+/, '');
}

/** A card back may list interchangeable answers separated by ";" or "|". */
export function acceptableAnswers(answer: string): string[] {
  return answer
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = row;
  }
  return prev[b.length];
}

/** Typo budget: nothing for very short answers, then ~1 edit per 8 characters. */
function typoBudget(expected: string): number {
  if (expected.length <= 4) return 0;
  return Math.min(2, Math.floor(expected.length / 8) + 1);
}

export interface WrittenGrade {
  correct: boolean;
  /** True when the match needed typo tolerance, so the UI can say so. */
  fuzzy: boolean;
}

export function gradeWritten(given: string, expected: string): WrittenGrade {
  const got = normalize(given);
  if (!got) return { correct: false, fuzzy: false };

  const options = acceptableAnswers(expected).map(normalize).filter(Boolean);
  if (options.length === 0) return { correct: false, fuzzy: false };

  if (options.some((opt) => opt === got)) return { correct: true, fuzzy: false };

  const close = options.some((opt) => levenshtein(opt, got) <= typoBudget(opt));
  return { correct: close, fuzzy: close };
}

function scoreQuestion(question: Question, given: ResponseMap[string] | undefined): number {
  switch (question.type) {
    case 'written':
      return typeof given === 'string' && gradeWritten(given, question.answer).correct ? 1 : 0;
    case 'truefalse':
      return typeof given === 'boolean' && given === question.answer ? 1 : 0;
    case 'matching': {
      if (!given || typeof given !== 'object') return 0;
      const picks = given as Record<string, string>;
      const hits = question.pairs.filter(
        (pair) => normalize(picks[pair.cardId] ?? '') === normalize(pair.answer),
      ).length;
      return question.pairs.length === 0 ? 0 : hits / question.pairs.length;
    }
  }
}

/** Matching blocks are worth one point per pair; everything else is worth one. */
export function questionWeight(question: Question): number {
  return question.type === 'matching' ? question.pairs.length : 1;
}

export function gradeTest(test: Test, responses: ResponseMap): TestResult {
  const graded: GradedQuestion[] = test.questions.map((question) => {
    const given = responses[question.id];
    const score = scoreQuestion(question, given);
    return { question, score, correct: score >= 1, given };
  });

  const earned = graded.reduce((sum, g) => sum + g.score * questionWeight(g.question), 0);
  const possible = test.questions.reduce((sum, q) => sum + questionWeight(q), 0);

  return {
    test,
    graded,
    earned,
    possible,
    percent: possible === 0 ? 0 : (earned / possible) * 100,
  };
}
