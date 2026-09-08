import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  RELEARN_MS,
  LEECH_THRESHOLD,
  describeNext,
  dueCards,
  dueCount,
  gradeFor,
  isDue,
  isLeech,
  newReviewState,
  schedule,
} from '../src/lib/scheduler';
import type { Card } from '../src/types';

const card = (id: string, review?: Card['review']): Card => ({
  id,
  front: `front ${id}`,
  back: `back ${id}`,
  ...(review ? { review } : {}),
});

describe('gradeFor', () => {
  it('puts Again below the passing threshold and Good above it', () => {
    expect(gradeFor('again')).toBeLessThan(3);
    expect(gradeFor('good')).toBeGreaterThanOrEqual(3);
  });
});

describe('difficulty drives the schedule', () => {
  const now = 1_000_000_000_000;

  /** Runs the same rating repeatedly and reports where the card lands. */
  const drill = (rating: Parameters<typeof gradeFor>[0], times: number) => {
    let state = newReviewState();
    for (let i = 0; i < times; i++) state = schedule(state, gradeFor(rating), now);
    return state;
  };

  it('stretches a card that keeps being known', () => {
    expect(drill('good', 5).interval).toBeGreaterThan(drill('good', 3).interval);
  });

  it('sends Again back within the session every time', () => {
    expect(drill('again', 3).due).toBe(now + RELEARN_MS);
    expect(drill('again', 3).lapses).toBe(3);
  });

  it('holds ease steady on Good and drops it on Again', () => {
    expect(drill('good', 3).ease).toBe(newReviewState().ease);
    expect(drill('again', 3).ease).toBeLessThan(newReviewState().ease);
  });

  it('sets a card back to square one after a miss', () => {
    let state = drill('good', 4);
    expect(state.interval).toBeGreaterThan(6);
    state = schedule(state, gradeFor('again'), now);
    expect(state.reps).toBe(0);
    // The next pass restarts the ladder rather than resuming where it was.
    expect(schedule(state, gradeFor('good'), now).interval).toBe(1);
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

describe('describeNext', () => {
  const now = 3_000_000_000_000;

  it('describes each horizon in plain words', () => {
    expect(describeNext({ ...newReviewState(), due: now + RELEARN_MS }, now)).toBe('again shortly');
    expect(describeNext({ ...newReviewState(), due: now + DAY_MS }, now)).toBe('tomorrow');
    expect(describeNext({ ...newReviewState(), due: now + 5 * DAY_MS }, now)).toBe('in 5 days');
    expect(describeNext({ ...newReviewState(), due: now + 90 * DAY_MS }, now)).toBe('in 3 months');
  });
});
