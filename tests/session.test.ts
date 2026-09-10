import { describe, expect, it } from 'vitest';
import {
  answer,
  createSession,
  currentCard,
  isComplete,
  progress,
  retire,
} from '../src/lib/session';
import type { Effort, Outcome } from '../src/lib/scheduler';
import type { Card } from '../src/types';

const deck = (n: number): Card[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, front: `f${i}`, back: `b${i}` }));

const v = (outcome: Outcome, effort: Effort) => ({ outcome, effort });

/** Where c0 ends up in the queue after one answer. */
const placeOfFirst = (size: number, outcome: Outcome, effort: Effort) =>
  answer(createSession(deck(size)), v(outcome, effort)).queue.findIndex((c) => c.id === 'c0');

describe('what keeps a card in the run', () => {
  /** Whether one answer left the card in the queue. */
  const returns = (outcome: Outcome, effort: Effort) => {
    const session = answer(createSession(deck(8)), v(outcome, effort));
    return session.queue.some((c) => c.id === 'c0');
  };

  it('retires a card that was got without a struggle', () => {
    expect(returns('got-it', 'easy')).toBe(false);
    expect(returns('got-it', 'medium')).toBe(false);
  });

  it('keeps a card that was got but was hard work', () => {
    expect(returns('got-it', 'hard')).toBe(true);
  });

  it('keeps every miss, however it felt', () => {
    for (const effort of ['easy', 'medium', 'hard'] as const) {
      expect(returns('again', effort)).toBe(true);
    }
  });
});

describe('a dynamic session', () => {
  it('clears a card that was got and moves on', () => {
    let session = createSession(deck(3));
    session = answer(session, v('got-it', 'medium'));
    expect(currentCard(session)?.id).toBe('c1');
    expect(session.cleared).toEqual(['c0']);
    expect(session.queue).toHaveLength(2);
  });

  it('brings a miss back within a couple of cards', () => {
    let session = createSession(deck(6));
    session = answer(session, v('again', 'medium'));
    expect(session.queue.map((c) => c.id)).toEqual(['c1', 'c2', 'c0', 'c3', 'c4', 'c5']);
    expect(session.cleared).toEqual([]);
    expect(session.struggled).toEqual(['c0']);
  });

  it('brings a miss back sooner the worse it felt', () => {
    expect(placeOfFirst(8, 'again', 'hard')).toBeLessThan(placeOfFirst(8, 'again', 'medium'));
    expect(placeOfFirst(8, 'again', 'medium')).toBeLessThan(placeOfFirst(8, 'again', 'easy'));
  });

  it('pushes a hard-won card much further back than a miss', () => {
    expect(placeOfFirst(8, 'got-it', 'hard')).toBeGreaterThan(placeOfFirst(8, 'again', 'easy'));
  });

  it('brings a card back even when the queue is too short for the full gap', () => {
    let session = createSession(deck(2));
    session = answer(session, v('got-it', 'medium'));
    session = answer(session, v('got-it', 'hard'));
    expect(session.queue.map((c) => c.id)).toEqual(['c1']);
    expect(isComplete(session)).toBe(false);
  });

  it('does not end until every card was got without a struggle', () => {
    let session = createSession(deck(2));
    session = answer(session, v('again', 'medium'));
    session = answer(session, v('got-it', 'easy'));
    expect(isComplete(session)).toBe(false);
    // c0 is still waiting after being sent back.
    session = answer(session, v('got-it', 'medium'));
    expect(isComplete(session)).toBe(true);
    expect(session.cleared.sort()).toEqual(['c0', 'c1']);
  });

  it('keeps returning a card that always feels hard', () => {
    let session = createSession(deck(3));
    for (let i = 0; i < 5; i++) session = answer(session, v('got-it', 'hard'));
    expect(isComplete(session)).toBe(false);
    expect(session.cleared).toEqual([]);
  });

  it('counts a card once however many times it comes back', () => {
    let session = createSession(deck(1));
    session = answer(session, v('again', 'hard'));
    session = answer(session, v('again', 'medium'));
    session = answer(session, v('got-it', 'medium'));
    expect(session.struggled).toEqual(['c0']);
    expect(session.cleared).toEqual(['c0']);
    expect(isComplete(session)).toBe(true);
  });

  it('reports progress against the starting size', () => {
    let session = createSession(deck(4));
    expect(progress(session)).toBe(0);
    session = answer(session, v('got-it', 'easy'));
    expect(progress(session)).toBe(0.25);
  });

  it('retires a card the learner says is not hard after all', () => {
    let session = createSession(deck(3));
    session = answer(session, v('got-it', 'hard'));
    expect(session.struggled).toEqual(['c0']);

    session = retire(session, 'c0');
    expect(session.queue.some((c) => c.id === 'c0')).toBe(false);
    expect(session.struggled).toEqual([]);
    expect(session.cleared).toContain('c0');
  });

  it('handles an empty deck without hanging', () => {
    const session = createSession([]);
    expect(isComplete(session)).toBe(true);
    expect(progress(session)).toBe(1);
    expect(answer(session, v('got-it', 'easy'))).toEqual(session);
  });
});
