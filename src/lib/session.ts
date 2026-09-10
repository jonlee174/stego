import type { Card } from '../types';
import type { Effort, Outcome, Verdict } from './scheduler';

// A card leaves the run only once it was got and did not feel hard.

/** Cards to put in front of it before it returns; null retires it. */
const GAP: Record<Outcome, Record<Effort, number | null>> = {
  again: { hard: 1, medium: 2, easy: 3 },
  'got-it': { hard: 5, medium: null, easy: null },
};

export interface Session {
  queue: Card[];
  cleared: string[];
  /** Ids that needed more than one attempt. */
  struggled: string[];
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

export function progress(session: Session): number {
  return session.size === 0 ? 1 : session.cleared.length / session.size;
}

export function answer(session: Session, verdict: Verdict): Session {
  const card = currentCard(session);
  if (!card) return session;

  const rest = session.queue.slice(1);
  const gap = GAP[verdict.outcome][verdict.effort];

  if (gap === null) {
    return {
      ...session,
      queue: rest,
      cleared: session.cleared.includes(card.id)
        ? session.cleared
        : [...session.cleared, card.id],
    };
  }

  const at = Math.min(gap, rest.length);
  return {
    ...session,
    queue: [...rest.slice(0, at), card, ...rest.slice(at)],
    struggled: session.struggled.includes(card.id)
      ? session.struggled
      : [...session.struggled, card.id],
  };
}

/** Removes a card from the run entirely, for "not hard after all". */
export function retire(session: Session, cardId: string): Session {
  return {
    ...session,
    queue: session.queue.filter((card) => card.id !== cardId),
    cleared: session.cleared.includes(cardId) ? session.cleared : [...session.cleared, cardId],
    struggled: session.struggled.filter((id) => id !== cardId),
  };
}
