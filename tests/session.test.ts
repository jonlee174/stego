import { describe, expect, it } from 'vitest';
import {
  answer,
  createSession,
  currentCard,
  isComplete,
  progress,
  retire,
} from '../src/lib/session';
import type { Card } from '../src/types';

const deck = (n: number): Card[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, front: `f${i}`, back: `b${i}` }));

describe('a dynamic session', () => {
  it('clears a card answered Good and moves on', () => {
    let session = createSession(deck(3));
    session = answer(session, 'good');
    expect(currentCard(session)?.id).toBe('c1');
    expect(session.cleared).toEqual(['c0']);
    expect(session.queue).toHaveLength(2);
  });

  it('brings an Again card back within a couple of cards', () => {
    let session = createSession(deck(6));
    session = answer(session, 'again');
    expect(session.queue.map((c) => c.id)).toEqual(['c1', 'c2', 'c0', 'c3', 'c4', 'c5']);
    expect(session.cleared).toEqual([]);
    expect(session.struggled).toEqual(['c0']);
  });

  it('puts a returning card behind others rather than straight back up', () => {
    const session = answer(createSession(deck(8)), 'again');
    expect(session.queue.findIndex((c) => c.id === 'c0')).toBeGreaterThan(0);
  });

  it('brings a returning card back even near the end of the queue', () => {
    // Only one card is left in front of it, so the gap has to clamp.
    let session = createSession(deck(2));
    session = answer(session, 'good');
    session = answer(session, 'again');
    expect(session.queue.map((c) => c.id)).toEqual(['c1']);
    expect(isComplete(session)).toBe(false);
  });

  it('does not end until every card has been answered Good', () => {
    let session = createSession(deck(2));
    session = answer(session, 'again');
    session = answer(session, 'good');
    expect(isComplete(session)).toBe(false);
    // c0 is still waiting after being sent back.
    session = answer(session, 'good');
    expect(isComplete(session)).toBe(true);
    expect(session.cleared.sort()).toEqual(['c0', 'c1']);
  });

  it('keeps returning a card that is never answered Good', () => {
    let session = createSession(deck(3));
    for (let i = 0; i < 5; i++) session = answer(session, 'again');
    expect(isComplete(session)).toBe(false);
    expect(session.cleared).toEqual([]);
  });

  it('counts a card once however many times it comes back', () => {
    let session = createSession(deck(1));
    session = answer(session, 'again');
    session = answer(session, 'again');
    session = answer(session, 'good');
    expect(session.struggled).toEqual(['c0']);
    expect(session.cleared).toEqual(['c0']);
    expect(isComplete(session)).toBe(true);
  });

  it('reports progress against the starting size', () => {
    let session = createSession(deck(4));
    expect(progress(session)).toBe(0);
    session = answer(session, 'good');
    expect(progress(session)).toBe(0.25);
  });

  it('retires a card the learner says they know after all', () => {
    let session = createSession(deck(3));
    session = answer(session, 'again');
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
    expect(answer(session, 'good')).toEqual(session);
  });
});
