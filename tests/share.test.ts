import { describe, expect, it } from 'vitest';
import { parseDeckFile, serializeDecks } from '../src/lib/storage';

/**
 * A shared deck is just the export file under a different extension, so the
 * thing that matters is that what one device writes, another can read back and
 * add without losing cards.
 */
describe('a deck sent to someone else', () => {
  const deck = {
    id: 'd1',
    name: 'Jurassic Period',
    description: 'Shared with a friend',
    createdAt: 10,
    updatedAt: 20,
    cards: [
      { id: 'c1', front: 'Stegosaurus', back: 'Plated dinosaur' },
      { id: 'c2', front: 'Allosaurus', back: 'Jurassic predator' },
    ],
  };

  it('survives the trip out and back', () => {
    const sent = serializeDecks([deck], { dino: 'triceratops', palette: 'pink', mode: 'dark' });
    const received = parseDeckFile(sent);

    expect(received).toHaveLength(1);
    expect(received[0].name).toBe('Jurassic Period');
    expect(received[0].cards.map((c) => [c.front, c.back])).toEqual([
      ['Stegosaurus', 'Plated dinosaur'],
      ['Allosaurus', 'Jurassic predator'],
    ]);
  });

  it('reads a plain exported file too, so older shares still open', () => {
    const received = parseDeckFile(serializeDecks([deck]));
    expect(received[0].cards).toHaveLength(2);
  });

  it('ignores a file that is not a deck rather than throwing', () => {
    expect(parseDeckFile('{"notes":[]}')).toEqual([]);
    expect(() => parseDeckFile('nonsense')).toThrow();
  });
});
