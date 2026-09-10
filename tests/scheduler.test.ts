import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  RELEARN_MS,
  LEECH_THRESHOLD,
  dueCards,
  dueCount,
  gradeFor,
  isDue,
  isLeech,
  newReviewState,
  schedule,
  type Effort,
  type Outcome,
} from '../src/lib/scheduler';
import type { Card } from '../src/types';

const card = (id: string, review?: Card['review']): Card => ({
  id,
  front: `front ${id}`,
  back: `back ${id}`,
  ...(review ? { review } : {}),
});

const v = (outcome: Outcome, effort: Effort) => ({ outcome, effort });

describe('gradeFor', () => {
  it('puts every miss below the passing threshold', () => {
    for (const effort of ['easy', 'medium', 'hard'] as const) {
      expect(gradeFor(v('again', effort))).toBeLessThan(3);
    }
  });

  it('puts every pass at or above it', () => {
    for (const effort of ['easy', 'medium', 'hard'] as const) {
      expect(gradeFor(v('got-it', effort))).toBeGreaterThanOrEqual(3);
    }
  });

  it('orders a pass by how much work it was', () => {
    expect(gradeFor(v('got-it', 'hard'))).toBeLessThan(gradeFor(v('got-it', 'medium')));
    expect(gradeFor(v('got-it', 'medium'))).toBeLessThan(gradeFor(v('got-it', 'easy')));
  });
});

describe('the verdict drives the schedule', () => {
  const now = 1_000_000_000_000;

  /** Runs the same verdict repeatedly and reports where the card lands. */
  const drill = (outcome: Outcome, effort: Effort, times: number) => {
    let state = newReviewState();
    for (let i = 0; i < times; i++) state = schedule(state, gradeFor(v(outcome, effort)), now);
    return state;
  };

  it('stretches Easy further than Medium, and Medium further than Hard', () => {
    expect(drill('got-it', 'easy', 5).interval).toBeGreaterThan(
      drill('got-it', 'medium', 5).interval,
    );
    expect(drill('got-it', 'medium', 5).interval).toBeGreaterThan(
      drill('got-it', 'hard', 5).interval,
    );
  });

  it('keeps a hard-won card close rather than letting it run away', () => {
    // Five passes rated Hard should still be well inside a month.
    expect(drill('got-it', 'hard', 5).interval).toBeLessThan(30);
  });

  it('sends a miss back within the session every time', () => {
    expect(drill('again', 'medium', 3).due).toBe(now + RELEARN_MS);
    expect(drill('again', 'medium', 3).lapses).toBe(3);
  });

  it('lowers ease for Hard and raises it for Easy', () => {
    expect(drill('got-it', 'hard', 3).ease).toBeLessThan(newReviewState().ease);
    expect(drill('got-it', 'easy', 3).ease).toBeGreaterThan(newReviewState().ease);
  });

  it('sets a card back to square one after a miss', () => {
    let state = drill('got-it', 'medium', 4);
    expect(state.interval).toBeGreaterThan(6);
    state = schedule(state, gradeFor(v('again', 'hard')), now);
    expect(state.reps).toBe(0);
    // The next pass restarts the ladder rather than resuming where it was.
    expect(schedule(state, gradeFor(v('got-it', 'medium')), now).interval).toBe(1);
  });
});

describe('leeches', () => {
  it('flags a card only once it has been missed enough times', () => {
    expect(isLeech(undefined)).toBe(false);
    expect(isLeech({ ...newReviewState(), lapses: LEECH_THRESHOLD - 1 })).toBe(false);
    expect(isLeech({ ...newReviewState(), lapses: LEECH_THRESHOLD })).toBe(true);
  });
});

describe('schedule', () => {
  const now = 1_000_000_000_000;

  it('sends a brand new card one day out', () => {
    const state = schedule(undefined, 4, now);
    expect(state.reps).toBe(1);
    expect(state.interval).toBe(1);
    expect(state.due).toBe(now + DAY_MS);
  });

  it('follows the 1 then 6 then multiply progression', () => {
    let state = schedule(undefined, 4, now);
    state = schedule(state, 4, now);
    expect(state.interval).toBe(6);
    const third = schedule(state, 4, now);
    expect(third.interval).toBe(Math.round(6 * state.ease));
  });

  it('multiplies by the card ease once past the fixed first two steps', () => {
    const easy = schedule({ ...newReviewState(), ease: 2.8, interval: 10, reps: 4 }, 4, now);
    const sticky = schedule({ ...newReviewState(), ease: 1.4, interval: 10, reps: 4 }, 4, now);
    expect(easy.interval).toBeGreaterThan(sticky.interval);
  });

  it('brings a missed card back within the session and counts a lapse', () => {
    const learned = schedule(schedule(undefined, 4, now), 4, now);
    const missed = schedule(learned, 1, now);
    expect(missed.due).toBe(now + RELEARN_MS);
    expect(missed.reps).toBe(0);
    expect(missed.lapses).toBe(1);
    expect(missed.ease).toBeLessThan(learned.ease);
  });

  it('never lets ease fall below the floor', () => {
    let state = newReviewState();
    for (let i = 0; i < 30; i++) state = schedule(state, 1, now);
    expect(state.ease).toBeGreaterThanOrEqual(1.3);
  });
});

describe('due selection', () => {
  const now = 2_000_000_000_000;

  it('treats a card that has never been reviewed as due', () => {
    expect(isDue(card('a'), now)).toBe(true);
  });

  it('excludes a card scheduled for the future', () => {
    expect(isDue(card('a', { ...newReviewState(), due: now + DAY_MS }), now)).toBe(false);
  });

  it('returns the most overdue card first', () => {
    const cards = [
      card('soon', { ...newReviewState(), due: now - 1000 }),
      card('overdue', { ...newReviewState(), due: now - DAY_MS }),
      card('later', { ...newReviewState(), due: now + DAY_MS }),
    ];
    expect(dueCards(cards, now).map((c) => c.id)).toEqual(['overdue', 'soon']);
    expect(dueCount(cards, now)).toBe(2);
  });
});

