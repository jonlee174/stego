import type { Deck, Tombstone } from '../types';

// Merged per deck, not per library: edits to different decks on different
// devices both have to survive. Deletions need tombstones or they come back.

/** How long a deletion is remembered. Long enough for any device to see it. */
export const TOMBSTONE_TTL_MS = 90 * 86_400_000;

export interface Library {
  decks: Deck[];
  deleted: Tombstone[];
}

export interface MergeResult extends Library {
  /** True when the merge differs from what this device already had. */
  changed: boolean;
}

function byId(decks: Deck[]): Map<string, Deck> {
  return new Map(decks.map((deck) => [deck.id, deck]));
}

/** Latest deletion time per deck id across both sides. */
function mergeTombstones(a: Tombstone[], b: Tombstone[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of [...a, ...b]) {
    const seen = out.get(t.id);
    if (seen === undefined || t.at > seen) out.set(t.id, t.at);
  }
  return out;
}

export function mergeLibraries(local: Library, remote: Library, now = Date.now()): MergeResult {
  const graves = mergeTombstones(local.deleted, remote.deleted);
  const localDecks = byId(local.decks);
  const remoteDecks = byId(remote.decks);

  const decks: Deck[] = [];
  for (const id of new Set([...localDecks.keys(), ...remoteDecks.keys()])) {
    const mine = localDecks.get(id);
    const theirs = remoteDecks.get(id);
    // A tie keeps the local copy, so a no-op sync writes nothing.
    const winner =
      mine && theirs ? (theirs.updatedAt > mine.updatedAt ? theirs : mine) : (mine ?? theirs);
    if (!winner) continue;

    // An edit newer than the deletion wins: the later action is the one meant.
    const buried = graves.get(id);
    if (buried !== undefined && buried >= winner.updatedAt) continue;
    decks.push(winner);
  }

  decks.sort((a, b) => b.updatedAt - a.updatedAt);

  const deleted: Tombstone[] = [...graves]
    .filter(([, at]) => now - at < TOMBSTONE_TTL_MS)
    .map(([id, at]) => ({ id, at }));

  return { decks, deleted, changed: !sameLibrary(local, { decks, deleted }) };
}

/** Compares by content, so an unchanged sync can skip writing anything. */
export function sameLibrary(a: Library, b: Library): boolean {
  if (a.decks.length !== b.decks.length || a.deleted.length !== b.deleted.length) return false;
  const other = byId(b.decks);
  for (const deck of a.decks) {
    const match = other.get(deck.id);
    if (!match || JSON.stringify(match) !== JSON.stringify(deck)) return false;
  }
  const graves = new Map(b.deleted.map((t) => [t.id, t.at]));
  return a.deleted.every((t) => graves.get(t.id) === t.at);
}

/** Drops deletions old enough that every device has long since seen them. */
export function pruneTombstones(deleted: Tombstone[], now = Date.now()): Tombstone[] {
  return deleted.filter((t) => now - t.at < TOMBSTONE_TTL_MS);
}
