import type { Card, ReviewState } from '../types';

/**
 * Spaced repetition, SM-2 driven by a self reported difficulty.
 *
 * How hard a card felt is something only the responder knows. Timing was tried
 * as a proxy and dropped: it cannot tell a confident answer from a lucky guess,
 * and it punishes long cards and slow readers for the wrong reasons.
 */

export const DAY_MS = 86_400_000;
/** A missed card comes back within the same session rather than tomorrow. */
export const RELEARN_MS = 10 * 60_000;

const MIN_EASE = 1.3;
const START_EASE = 2.5;

export function newReviewState(): ReviewState {
  return { ease: START_EASE, interval: 0, due: 0, reps: 0, lapses: 0 };
}

/**
 * What the responder says about the card they just saw.
 *
 * Two ratings, not four. Hard and Easy were dropped: deciding between four
 * shades of "sort of knew it" is a judgement call on every single card, and the
 * lapse count is what actually moves the schedule.
 */
export type Difficulty = 'again' | 'good';

/** The SM-2 grade each rating maps to. Anything under 3 triggers relearning. */
const GRADES: Record<Difficulty, number> = { again: 1, good: 4 };

export function gradeFor(difficulty: Difficulty): number {
  return GRADES[difficulty];
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
  const interval =
    reps === 1 ? 1 : reps === 2 ? 6 : Math.max(1, Math.round(state.interval * state.ease));
  // The standard SM-2 ease adjustment: 5 nudges it up, 3 nudges it down.
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

/** Human wording for when a card comes back, used in the study summary. */
export function describeNext(state: ReviewState, now: number = Date.now()): string {
  const ms = state.due - now;
  if (ms <= RELEARN_MS) return 'again shortly';
  const days = Math.round(ms / DAY_MS);
  if (days <= 1) return 'tomorrow';
  if (days < 30) return `in ${days} days`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'in a month' : `in ${months} months`;
}
