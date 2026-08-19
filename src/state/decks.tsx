import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  loadDecks,
  saveDecks,
  parseDeckFile,
  serializeDecks,
  watchDecks,
} from '../lib/storage';
import { makeId } from '../lib/random';
import { starterDeck } from './starter';
import type { Card, Deck } from '../types';

interface DecksApi {
  decks: Deck[];
  ready: boolean;
  getDeck(id: string): Deck | undefined;
  createDeck(name: string, description: string, cards?: Card[]): Deck;
  updateDeck(id: string, patch: Partial<Omit<Deck, 'id'>>): void;
  deleteDeck(id: string): void;
  duplicateDeck(id: string): Deck | undefined;
  importFile(raw: string, mode: 'merge' | 'replace'): number;
  exportFile(): string;
}

const DecksContext = createContext<DecksApi | null>(null);

export function useDecks(): DecksApi {
  const ctx = useContext(DecksContext);
  if (!ctx) throw new Error('useDecks must be used inside <DecksProvider>');
  return ctx;
}

export function newCard(front = '', back = ''): Card {
  return { id: makeId('card'), front, back };
}

export function DecksProvider({ children }: { children: ReactNode }) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [ready, setReady] = useState(false);
  /** Serialization this app last saved, to tell our writes from remote ones. */
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDecks().then((loaded) => {
      if (cancelled) return;
      const initial = loaded.length > 0 ? loaded : [starterDeck()];
      // Priming the guard skips a redundant rewrite of what we just read, but
      // a freshly seeded starter deck still has to be written out once.
      lastSaved.current = loaded.length > 0 ? serializeDecks(initial) : null;
      setDecks(initial);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Write back on every change. The first pass also lands the starter deck on
  // disk so a fresh install ends up with a real decks.json.
  useEffect(() => {
    if (!ready) return;
    const serialized = serializeDecks(decks);
    if (serialized === lastSaved.current) return;
    lastSaved.current = serialized;
    void saveDecks(decks);
  }, [decks, ready]);

  // Adopt edits that arrived from another device. Ignoring content identical to
  // our own last save keeps this from looping against the save effect above.
  useEffect(() => {
    if (!ready) return;
    return watchDecks((incoming) => {
      const serialized = serializeDecks(incoming);
      if (serialized === lastSaved.current) return;
      lastSaved.current = serialized;
      setDecks(incoming);
    });
  }, [ready]);

  const api = useMemo<DecksApi>(() => {
    return {
      decks,
      ready,
      getDeck: (id) => decks.find((d) => d.id === id),
      createDeck(name, description, cards = []) {
        const now = Date.now();
        const deck: Deck = {
          id: makeId('deck'),
          name: name.trim() || 'Untitled Deck',
          description: description.trim(),
          cards,
          createdAt: now,
          updatedAt: now,
        };
        setDecks((prev) => [deck, ...prev]);
        return deck;
      },
      updateDeck(id, patch) {
        setDecks((prev) =>
          prev.map((d) => (d.id === id ? { ...d, ...patch, id: d.id, updatedAt: Date.now() } : d)),
        );
      },
      deleteDeck(id) {
        setDecks((prev) => prev.filter((d) => d.id !== id));
      },
      duplicateDeck(id) {
        const source = decks.find((d) => d.id === id);
        if (!source) return undefined;
        const now = Date.now();
        const copy: Deck = {
          ...source,
          id: makeId('deck'),
          name: `${source.name} (copy)`,
          cards: source.cards.map((c) => ({ ...c, id: makeId('card') })),
          createdAt: now,
          updatedAt: now,
        };
        setDecks((prev) => [copy, ...prev]);
        return copy;
      },
      importFile(raw, mode) {
        const incoming = parseDeckFile(raw).map((deck) => ({
          ...deck,
          // Re-key so an import can never collide with a deck already here.
          id: makeId('deck'),
          cards: deck.cards.map((c) => ({ ...c, id: makeId('card') })),
        }));
        setDecks((prev) => (mode === 'replace' ? incoming : [...incoming, ...prev]));
        return incoming.length;
      },
      exportFile: () => serializeDecks(decks),
    };
  }, [decks, ready]);

  return <DecksContext.Provider value={api}>{children}</DecksContext.Provider>;
}

/** Convenience for screens that are handed a deck id by the router. */
export function useDeck(id: string | undefined): Deck | undefined {
  const { decks } = useDecks();
  return useMemo(() => decks.find((d) => d.id === id), [decks, id]);
}
