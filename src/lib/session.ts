import type { Card } from '../types';
import type { Difficulty } from './scheduler';

/**
 * A dynamic study session.
 *
 * Every card has to be answered Good before the session ends. A card rated
 * Again goes back into the queue instead, so the run naturally lengthens around
 * the cards that are giving trouble and finishes only once none of them are.
 */

/** How many cards to put in front of a card before it returns. */
const GAP: Record<Difficulty, number | null> = {
  again: 2,
  // Good retires the card for this session.
  good: null,
};

export interface Session {
  /** Cards still to answer, in order. */
  queue: Card[];
  /** Ids answered Good or Easy, so progress can be shown. */
  cleared: string[];
  /** Ids that needed more than one attempt. */
  struggled: string[];
  /** Total distinct cards the session started with. */
  size: number;
}

export function createSession(cards: Card[]): Session {
  return { queue: [...cards], cleared: [], struggled: [], size: cards.length };
}

export function currentCard(session: Session): Card | undefined {
  return session.queue[0];
}

export function isComplete(session: Session): boolean {
  return session.queue.length === 0;
}

/** Cards cleared out of the total, for a progress bar. */
export function progress(session: Session): number {
  return session.size === 0 ? 1 : session.cleared.length / session.size;
}

/**
 * Answers the current card and returns the next state.
 * A card rated Again is pushed back into the queue rather than cleared.
 */
export function answer(session: Session, difficulty: Difficulty): Session {
  const card = currentCard(session);
  if (!card) return session;

  const rest = session.queue.slice(1);
  const gap = GAP[difficulty];

  if (gap === null) {
    return {
      ...session,
      queue: rest,
      cleared: session.cleared.includes(card.id)
        ? session.cleared
        : [...session.cleared, card.id],
    };
  }

  // Reinsert far enough back that it is not the very next card, but close
  // enough to still be in this session.
  const at = Math.min(gap, rest.length);
  return {
    ...session,
    queue: [...rest.slice(0, at), card, ...rest.slice(at)],
    struggled: session.struggled.includes(card.id)
      ? session.struggled
      : [...session.struggled, card.id],
  };
}

/** Removes a card from the run entirely, for "I know this one after all". */
export function retire(session: Session, cardId: string): Session {
  return {
    ...session,
    queue: session.queue.filter((card) => card.id !== cardId),
    cleared: session.cleared.includes(cardId) ? session.cleared : [...session.cleared, cardId],
    struggled: session.struggled.filter((id) => id !== cardId),
  };
}
