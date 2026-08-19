import { describe, expect, it } from 'vitest';
import { parseDeckFile, serializeDecks } from '../src/lib/storage';

describe('parseDeckFile', () => {
  it('reads the 2021 Kivy format', () => {
    const legacy = JSON.stringify({
      decks: [
        {
          name: 'Old Deck',
          description: 'From the Kivy build',
          deck: [
            { info_front: 'Stegosaurus', info_back: 'Plated dinosaur' },
            { info_front: 'T. rex', info_back: 'Big teeth' },
          ],
        },
      ],
    });

    const decks = parseDeckFile(legacy);
    expect(decks).toHaveLength(1);
    expect(decks[0].name).toBe('Old Deck');
    expect(decks[0].cards.map((c) => [c.front, c.back])).toEqual([
      ['Stegosaurus', 'Plated dinosaur'],
      ['T. rex', 'Big teeth'],
    ]);
    expect(decks[0].cards.every((c) => c.id)).toBe(true);
  });

  it('round-trips the current format', () => {
    const decks = parseDeckFile(
      serializeDecks([
        {
          id: 'd1',
          name: 'Deck',
          description: 'desc',
          createdAt: 111,
          updatedAt: 222,
          cards: [{ id: 'c1', front: 'a', back: 'b' }],
        },
      ]),
    );
    expect(decks[0]).toMatchObject({ id: 'd1', createdAt: 111, updatedAt: 222 });
    expect(decks[0].cards[0]).toEqual({ id: 'c1', front: 'a', back: 'b' });
  });

  it('tolerates junk instead of throwing', () => {
    expect(parseDeckFile('{}')).toEqual([]);
    expect(parseDeckFile('{"decks": "nope"}')).toEqual([]);
    expect(parseDeckFile('null')).toEqual([]);
  });

  it('fills in missing fields on a half-written deck', () => {
    const decks = parseDeckFile('{"decks":[{"deck":[{"info_front":"only front"}]}]}');
    expect(decks[0].name).toBe('Deck 1');
    expect(decks[0].description).toBe('');
    expect(decks[0].cards[0]).toMatchObject({ front: 'only front', back: '' });
  });
});
