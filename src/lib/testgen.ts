import { makeId, pickOne, sample, shuffle } from './random';
import { normalize } from './grading';
import type {
  Card,
  Deck,
  Direction,
  MatchingQuestion,
  Question,
  Test,
  TestConfig,
  TrueFalseQuestion,
  WrittenQuestion,
} from '../types';

export const MIN_MATCHING_GROUP = 2;
export const MAX_MATCHING_GROUP = 8;

/** Cards with a blank side can't be asked about. */
export function usableCards(deck: Deck): Card[] {
  return deck.cards.filter((c) => c.front.trim() !== '' && c.back.trim() !== '');
}

interface Sided {
  card: Card;
  prompt: string;
  answer: string;
  /** True when the card's back is being used as the prompt. */
  flipped: boolean;
}

function orient(card: Card, direction: Direction, rand: () => number): Sided {
  const flipped = direction === 'back-to-front' || (direction === 'mixed' && rand() < 0.5);
  return flipped
    ? { card, prompt: card.back, answer: card.front, flipped }
    : { card, prompt: card.front, answer: card.back, flipped };
}

/** The side of `card` that would serve as an answer in the same orientation. */
function answerSide(card: Card, flipped: boolean): string {
  return flipped ? card.front : card.back;
}

/**
 * Hands out cards without repeating one until the whole pool has been used.
 * Only matters when the requested question count exceeds the pool.
 */
function dealer(pool: Card[], rand: () => number) {
  let queue: Card[] = [];
  const refill = () => {
    queue = shuffle(pool, rand);
  };
  return {
    take(): Card {
      if (queue.length === 0) refill();
      return queue.pop()!;
    },
    /** Pull `n` cards that don't collide on the given side. */
    takeDistinct(n: number, sideOf: (c: Card) => string): Card[] {
      const picked: Card[] = [];
      const seen = new Set<string>();
      // Bounded so a deck full of duplicate answers can't spin forever.
      for (let attempts = 0; picked.length < n && attempts < pool.length * 4; attempts++) {
        const card = this.take();
        const key = normalize(sideOf(card));
        if (seen.has(key)) continue;
        seen.add(key);
        picked.push(card);
      }
      return picked;
    },
  };
}

export function clampGroup(groupSize: number): number {
  return Math.max(MIN_MATCHING_GROUP, Math.min(MAX_MATCHING_GROUP, Math.round(groupSize)));
}

/** How many cards a config consumes. */
export function cardsUsed(config: TestConfig): number {
  return config.written + config.truefalse + config.matching * clampGroup(config.matchingGroupSize);
}

/** Cards a default test draws before the user widens it by hand. */
const DEFAULT_CARD_CAP = 20;

export function defaultConfig(deck: Deck): TestConfig {
  const available = usableCards(deck).length;
  const cardCount = Math.min(available, DEFAULT_CARD_CAP);
  const groupSize = clampGroup(Math.min(4, Math.max(MIN_MATCHING_GROUP, cardCount)));

  // One matching block, but only when it still leaves cards for other types.
  const matching = cardCount >= groupSize + 2 ? 1 : 0;
  const spare = cardCount - matching * groupSize;
  const written = cardCount >= 2 ? Math.ceil(spare * 0.6) : spare;

  return {
    deckId: deck.id,
    cardCount,
    written,
    truefalse: cardCount >= 2 ? spare - written : 0,
    matching,
    matchingGroupSize: groupSize,
    direction: 'front-to-back',
  };
}

export interface GenerationIssue {
  kind: 'empty-deck' | 'no-questions' | 'truefalse-needs-two';
  message: string;
}

export function validate(deck: Deck, config: TestConfig): GenerationIssue | null {
  const pool = usableCards(deck);
  if (pool.length === 0) {
    return { kind: 'empty-deck', message: 'This deck has no cards with both sides filled in.' };
  }
  if (config.written + config.truefalse + config.matching === 0) {
    return { kind: 'no-questions', message: 'Pick at least one question to answer.' };
  }
  if (config.truefalse > 0 && pool.length < 2) {
    return {
      kind: 'truefalse-needs-two',
      message: 'True/False needs at least two cards so a false pairing can be built.',
    };
  }
  return null;
}

function buildWritten(sided: Sided): WrittenQuestion {
  return {
    id: makeId('q'),
    type: 'written',
    cardIds: [sided.card.id],
    prompt: sided.prompt,
    answer: sided.answer,
  };
}

function buildTrueFalse(sided: Sided, pool: Card[], rand: () => number): TrueFalseQuestion {
  const wantTrue = rand() < 0.5;
  const truthful = normalize(sided.answer);

  if (!wantTrue) {
    // A decoy must be a different card whose answer side actually differs,
    // otherwise the "false" claim would secretly be true.
    const distractors = pool.filter(
      (c) => c.id !== sided.card.id && normalize(answerSide(c, sided.flipped)) !== truthful,
    );
    if (distractors.length > 0) {
      const decoy = pickOne(distractors, rand);
      return {
        id: makeId('q'),
        type: 'truefalse',
        cardIds: [sided.card.id, decoy.id],
        prompt: sided.prompt,
        claim: answerSide(decoy, sided.flipped),
        answer: false,
      };
    }
  }

  return {
    id: makeId('q'),
    type: 'truefalse',
    cardIds: [sided.card.id],
    prompt: sided.prompt,
    claim: sided.answer,
    answer: true,
  };
}

function buildMatching(cards: Card[], flipped: boolean, rand: () => number): MatchingQuestion | null {
  const pairs = cards.map((card) => ({
    cardId: card.id,
    prompt: flipped ? card.back : card.front,
    answer: flipped ? card.front : card.back,
  }));

  // Duplicate answers would make more than one arrangement correct.
  const unique = new Map<string, (typeof pairs)[number]>();
  for (const pair of pairs) {
    const key = normalize(pair.answer);
    if (!unique.has(key)) unique.set(key, pair);
  }
  const kept = [...unique.values()];
  if (kept.length < MIN_MATCHING_GROUP) return null;

  return {
    id: makeId('q'),
    type: 'matching',
    cardIds: kept.map((p) => p.cardId),
    pairs: shuffle(kept, rand),
    choices: shuffle(
      kept.map((p) => p.answer),
      rand,
    ),
  };
}

export function generateTest(deck: Deck, config: TestConfig, rand: () => number = Math.random): Test {
  const all = usableCards(deck);
  const pool = sample(all, Math.max(1, Math.min(config.cardCount, all.length)), rand);
  const groupSize = clampGroup(config.matchingGroupSize);
  const deal = dealer(pool, rand);
  const questions: Question[] = [];

  // Matching first: it is the pickiest about which cards it can use.
  for (let i = 0; i < config.matching; i++) {
    // One orientation per block — a block of mixed directions is unsolvable.
    const flipped =
      config.direction === 'back-to-front' || (config.direction === 'mixed' && rand() < 0.5);
    const cards = deal.takeDistinct(Math.min(groupSize, pool.length), (c) =>
      answerSide(c, flipped),
    );
    const question = buildMatching(cards, flipped, rand);
    if (question) questions.push(question);
  }

  for (let i = 0; i < config.truefalse; i++) {
    if (pool.length < 2) break;
    questions.push(buildTrueFalse(orient(deal.take(), config.direction, rand), pool, rand));
  }

  for (let i = 0; i < config.written; i++) {
    questions.push(buildWritten(orient(deal.take(), config.direction, rand)));
  }

  return {
    deckId: deck.id,
    deckName: deck.name,
    createdAt: Date.now(),
    questions: shuffle(questions, rand),
  };
}
