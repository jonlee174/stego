import type { Card, ReviewState } from '../types';

// SM-2, driven by a self reported verdict. Timing was tried and dropped: it
// cannot tell a confident answer from a lucky guess.

export const DAY_MS = 86_400_000;
/** A missed card comes back within the same session rather than tomorrow. */
export const RELEARN_MS = 10 * 60_000;

const MIN_EASE = 1.3;
const START_EASE = 2.5;

export function newReviewState(): ReviewState {
  return { ease: START_EASE, interval: 0, due: 0, reps: 0, lapses: 0 };
}

// Asked in two steps: what happened, then how hard it felt. One row of four
// ratings made every card a judgement call.
export type Outcome = 'again' | 'got-it';
export type Effort = 'easy' | 'medium' | 'hard';

export interface Verdict {
  outcome: Outcome;
  effort: Effort;
}

/** Under 3 is a lapse, so every miss relearns regardless of effort. */
const GRADES: Record<Outcome, Record<Effort, number>> = {
  'got-it': { easy: 5, medium: 4, hard: 3 },
  again: { easy: 2, medium: 1, hard: 1 },
};

export function gradeFor(verdict: Verdict): number {
  return GRADES[verdict.outcome][verdict.effort];
}

/** A card missed this many times is the card's fault, not the learner's. */
export const LEECH_THRESHOLD = 8;

export function isLeech(state: ReviewState | undefined): boolean {
  return (state?.lapses ?? 0) >= LEECH_THRESHOLD;
}

/** Applies one review to a card's schedule. */
export function schedule(
  previous: ReviewState | undefined,
  grade: number,
  now: number = Date.now(),
): ReviewState {
  const state = previous ?? newReviewState();

  if (grade < 3) {
    return {
      ease: Math.max(MIN_EASE, state.ease - 0.2),
      interval: 0,
      due: now + RELEARN_MS,
      reps: 0,
      lapses: state.lapses + 1,
      lastGrade: grade,
    };
  }

  const reps = state.reps + 1;
  // Hard work creeps forward instead of multiplying by the full ease.
  const growth = grade === 3 ? Math.max(1.2, state.ease - 0.8) : state.ease;
  const interval =
    reps === 1 ? 1 : reps === 2 ? 6 : Math.max(1, Math.round(state.interval * growth));
  const ease = Math.max(MIN_EASE, state.ease + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));

  return {
    ease: Math.round(ease * 100) / 100,
    interval,
    due: now + interval * DAY_MS,
    reps,
    lapses: state.lapses,
    lastGrade: grade,
  };
}

export function isDue(card: Card, now: number = Date.now()): boolean {
  // A card never reviewed is due immediately.
  return (card.review?.due ?? 0) <= now;
}

export function dueCards(cards: Card[], now: number = Date.now()): Card[] {
  return cards
    .filter((card) => isDue(card, now))
    .sort((a, b) => (a.review?.due ?? 0) - (b.review?.due ?? 0));
}

export function dueCount(cards: Card[], now: number = Date.now()): number {
  return cards.reduce((total, card) => total + (isDue(card, now) ? 1 : 0), 0);
}
