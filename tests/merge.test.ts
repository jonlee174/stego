import { describe, expect, it } from 'vitest';
import { TOMBSTONE_TTL_MS, mergeLibraries, pruneTombstones, sameLibrary } from '../src/lib/merge';
import type { Deck } from '../src/types';

const deck = (id: string, updatedAt: number, name = id): Deck => ({
  id,
  name,
  description: '',
  cards: [],
  createdAt: 0,
  updatedAt,
});

const lib = (decks: Deck[], deleted: { id: string; at: number }[] = []) => ({ decks, deleted });

describe('merging two copies of a library', () => {
  it('keeps a deck that only one side has', () => {
    const merged = mergeLibraries(lib([deck('a', 10)]), lib([deck('b', 20)]));
    expect(merged.decks.map((d) => d.id).sort()).toEqual(['a', 'b']);
  });

  it('takes the newer edit of a deck both sides have', () => {
    const merged = mergeLibraries(
      lib([deck('a', 10, 'old name')]),
      lib([deck('a', 20, 'new name')]),
    );
    expect(merged.decks).toHaveLength(1);
    expect(merged.decks[0].name).toBe('new name');
  });

  it('keeps edits made to different decks on different devices', () => {
    // The case a whole-file last-write-wins would get wrong.
    const phone = lib([deck('a', 30, 'edited on phone'), deck('b', 5)]);
    const ipad = lib([deck('a', 5), deck('b', 40, 'edited on ipad')]);
    const merged = mergeLibraries(phone, ipad);
    expect(merged.decks.find((d) => d.id === 'a')!.name).toBe('edited on phone');
    expect(merged.decks.find((d) => d.id === 'b')!.name).toBe('edited on ipad');
  });

  it('does not resurrect a deck deleted here that the other side still has', () => {
    const local = lib([], [{ id: 'a', at: 50 }]);
    const remote = lib([deck('a', 10)]);
    expect(mergeLibraries(local, remote).decks).toEqual([]);
  });

  it('carries a deletion made elsewhere back to this device', () => {
    // Deletion times are real clock times, so they have to sit near `now` or
    // the age-based pruning below treats them as ancient history.
    const now = 1_000_000_000_000;
    const local = lib([deck('a', now - 9000)]);
    const remote = lib([], [{ id: 'a', at: now - 1000 }]);
    const merged = mergeLibraries(local, remote, now);
    expect(merged.decks).toEqual([]);
    expect(merged.deleted).toEqual([{ id: 'a', at: now - 1000 }]);
  });

  it('lets an edit newer than the deletion bring a deck back', () => {
    // Deleting on one device then editing on another means the edit came last,
    // and the later action is the one the person meant.
    const local = lib([], [{ id: 'a', at: 50 }]);
    const remote = lib([deck('a', 90, 'still wanted')]);
    expect(mergeLibraries(local, remote).decks.map((d) => d.name)).toEqual(['still wanted']);
  });

  it('reports no change when both sides already agree', () => {
    const same = lib([deck('a', 10)]);
    expect(mergeLibraries(same, lib([deck('a', 10)])).changed).toBe(false);
  });

  it('reports a change when the remote adds something', () => {
    expect(mergeLibraries(lib([deck('a', 10)]), lib([deck('b', 10)])).changed).toBe(true);
  });

  it('keeps the local copy when timestamps tie, so a sync stays a no-op', () => {
    const merged = mergeLibraries(lib([deck('a', 10, 'mine')]), lib([deck('a', 10, 'theirs')]));
    expect(merged.decks[0].name).toBe('mine');
    expect(merged.changed).toBe(false);
  });

  it('merges an empty remote without touching the local decks', () => {
    const merged = mergeLibraries(lib([deck('a', 10), deck('b', 20)]), lib([]));
    expect(merged.decks).toHaveLength(2);
    expect(merged.changed).toBe(false);
  });

  it('adopts the whole remote library on a fresh device', () => {
    const merged = mergeLibraries(lib([]), lib([deck('a', 10), deck('b', 20)]));
    expect(merged.decks).toHaveLength(2);
    expect(merged.changed).toBe(true);
  });

  it('orders the result newest first', () => {
    const merged = mergeLibraries(lib([deck('old', 1)]), lib([deck('new', 99)]));
    expect(merged.decks.map((d) => d.id)).toEqual(['new', 'old']);
  });
});

describe('tombstones', () => {
  const now = 1_000_000_000_000;

  it('forgets a deletion once every device has had time to see it', () => {
    const fresh = { id: 'a', at: now - 1000 };
    const stale = { id: 'b', at: now - TOMBSTONE_TTL_MS - 1000 };
    expect(pruneTombstones([fresh, stale], now)).toEqual([fresh]);
  });

  it('prunes as part of a merge', () => {
    const local = lib([], [{ id: 'a', at: now - TOMBSTONE_TTL_MS - 1 }]);
    expect(mergeLibraries(local, lib([]), now).deleted).toEqual([]);
  });

  it('keeps the later of two records of the same deletion', () => {
    const merged = mergeLibraries(
      lib([], [{ id: 'a', at: now - 5000 }]),
      lib([], [{ id: 'a', at: now - 1000 }]),
      now,
    );
    expect(merged.deleted).toEqual([{ id: 'a', at: now - 1000 }]);
  });
});

describe('sameLibrary', () => {
  it('sees through deck ordering', () => {
    const a = lib([deck('x', 1), deck('y', 2)]);
    const b = lib([deck('y', 2), deck('x', 1)]);
    expect(sameLibrary(a, b)).toBe(true);
  });

  it('notices a changed card list', () => {
    const a = lib([deck('x', 1)]);
    const b = lib([{ ...deck('x', 1), cards: [{ id: 'c', front: 'f', back: 'b' }] }]);
    expect(sameLibrary(a, b)).toBe(false);
  });
});
