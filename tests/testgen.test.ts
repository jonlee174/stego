import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/lib/random';
import { normalize } from '../src/lib/grading';
import {
  cardsUsed,
  defaultConfig,
  generateTest,
  usableCards,
  validate,
} from '../src/lib/testgen';
import type { Deck, TestConfig } from '../src/types';

function makeDeck(n: number, name = 'Deck'): Deck {
  return {
    id: 'deck1',
    name,
    description: '',
    createdAt: 0,
    updatedAt: 0,
    cards: Array.from({ length: n }, (_, i) => ({
      id: `c${i}`,
      front: `Front ${i}`,
      back: `Back ${i}`,
    })),
  };
}

const baseConfig = (deck: Deck, patch: Partial<TestConfig> = {}): TestConfig => ({
  deckId: deck.id,
  cardCount: deck.cards.length,
  written: 0,
  truefalse: 0,
  matching: 0,
  matchingGroupSize: 4,
  direction: 'front-to-back',
  ...patch,
});

describe('usableCards', () => {
  it('skips cards with a blank side', () => {
    const deck = makeDeck(3);
    deck.cards[1].back = '   ';
    expect(usableCards(deck)).toHaveLength(2);
  });
});

describe('generateTest', () => {
  const rand = () => mulberry32(20260818);

  it('produces exactly the requested number of each question type', () => {
    const deck = makeDeck(30);
    const config = baseConfig(deck, { written: 5, truefalse: 4, matching: 2, matchingGroupSize: 3 });
    const test = generateTest(deck, config, rand());

    const counts = { written: 0, truefalse: 0, matching: 0 };
    for (const q of test.questions) counts[q.type] += 1;
    expect(counts).toEqual({ written: 5, truefalse: 4, matching: 2 });
  });

  it('draws only from the requested slice of the deck', () => {
    const deck = makeDeck(40);
    const config = baseConfig(deck, { cardCount: 6, written: 6 });
    const test = generateTest(deck, config, rand());
    const used = new Set(test.questions.flatMap((q) => q.cardIds));
    expect(used.size).toBeLessThanOrEqual(6);
  });

  it('does not repeat a card while unused ones remain', () => {
    const deck = makeDeck(12);
    const config = baseConfig(deck, { written: 12 });
    const test = generateTest(deck, config, rand());
    const ids = test.questions.map((q) => q.cardIds[0]);
    expect(new Set(ids).size).toBe(12);
  });

  it('is reproducible for a given seed', () => {
    const deck = makeDeck(20);
    const config = baseConfig(deck, { written: 4, truefalse: 4, matching: 1 });
    const a = generateTest(deck, config, mulberry32(7));
    const b = generateTest(deck, config, mulberry32(7));
    expect(a.questions.map((q) => [q.type, q.cardIds])).toEqual(
      b.questions.map((q) => [q.type, q.cardIds]),
    );
  });

  it('labels each true/false claim honestly', () => {
    const deck = makeDeck(25);
    const config = baseConfig(deck, { truefalse: 25 });
    const test = generateTest(deck, config, rand());

    for (const q of test.questions) {
      if (q.type !== 'truefalse') continue;
      const card = deck.cards.find((c) => c.front === q.prompt)!;
      const claimMatches = normalize(card.back) === normalize(q.claim);
      expect(q.answer).toBe(claimMatches);
    }
  });

  it('produces both true and false claims over a run', () => {
    const deck = makeDeck(40);
    const test = generateTest(deck, baseConfig(deck, { truefalse: 40 }), rand());
    const answers = test.questions.map((q) => (q.type === 'truefalse' ? q.answer : null));
    expect(answers).toContain(true);
    expect(answers).toContain(false);
  });

  it('gives every matching block a distinct answer per prompt', () => {
    const deck = makeDeck(24);
    const test = generateTest(deck, baseConfig(deck, { matching: 4, matchingGroupSize: 5 }), rand());

    for (const q of test.questions) {
      if (q.type !== 'matching') continue;
      const answers = q.pairs.map((p) => normalize(p.answer));
      expect(new Set(answers).size).toBe(answers.length);
      // The bank must hold exactly the answers being asked for.
      expect([...q.choices].sort()).toEqual([...q.pairs.map((p) => p.answer)].sort());
    }
  });

  it('keeps one orientation within a matching block', () => {
    const deck = makeDeck(20);
    const test = generateTest(
      deck,
      baseConfig(deck, { matching: 3, matchingGroupSize: 4, direction: 'mixed' }),
      rand(),
    );

    for (const q of test.questions) {
      if (q.type !== 'matching') continue;
      const allForward = q.pairs.every((p) => p.prompt.startsWith('Front'));
      const allBackward = q.pairs.every((p) => p.prompt.startsWith('Back'));
      expect(allForward || allBackward).toBe(true);
    }
  });

  it('honours back-to-front direction', () => {
    const deck = makeDeck(10);
    const test = generateTest(
      deck,
      baseConfig(deck, { written: 10, direction: 'back-to-front' }),
      rand(),
    );
    for (const q of test.questions) {
      if (q.type !== 'written') continue;
      expect(q.prompt.startsWith('Back')).toBe(true);
      expect(q.answer.startsWith('Front')).toBe(true);
    }
  });

  it('survives a deck whose cards all share one answer', () => {
    const deck = makeDeck(6);
    for (const card of deck.cards) card.back = 'Same';
    const test = generateTest(
      deck,
      baseConfig(deck, { written: 3, truefalse: 3, matching: 1, matchingGroupSize: 3 }),
      rand(),
    );
    // Matching cannot be built from identical answers, so it is dropped rather
    // than emitted in an unanswerable form.
    expect(test.questions.filter((q) => q.type === 'matching')).toHaveLength(0);
    expect(test.questions.filter((q) => q.type === 'truefalse').every((q) => q.type === 'truefalse' && q.answer)).toBe(true);
  });

  it('handles a single-card deck without looping', () => {
    const deck = makeDeck(1);
    const test = generateTest(deck, baseConfig(deck, { written: 1, truefalse: 2 }), rand());
    expect(test.questions).toHaveLength(1);
    expect(test.questions[0].type).toBe('written');
  });
});

describe('config helpers', () => {
  it('counts the cards a config consumes', () => {
    const deck = makeDeck(10);
    expect(cardsUsed(baseConfig(deck, { written: 2, truefalse: 3, matching: 1, matchingGroupSize: 4 }))).toBe(9);
  });

  it('builds a default config that fits the deck', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 12, 19, 20, 21, 60, 500]) {
      const deck = makeDeck(n);
      const config = defaultConfig(deck);
      expect(config.cardCount).toBeLessThanOrEqual(n);
      expect(cardsUsed(config)).toBeLessThanOrEqual(config.cardCount);
      expect(validate(deck, config)).toBeNull();
      // A default test must actually ask something.
      expect(config.written + config.truefalse + config.matching).toBeGreaterThan(0);
      expect(generateTest(deck, config, mulberry32(3)).questions.length).toBeGreaterThan(0);
    }
  });

  it('rejects an empty deck and an empty mix', () => {
    const empty = makeDeck(0);
    expect(validate(empty, baseConfig(empty, { written: 1 }))?.kind).toBe('empty-deck');

    const deck = makeDeck(5);
    expect(validate(deck, baseConfig(deck))?.kind).toBe('no-questions');
  });
});
