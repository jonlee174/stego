import { useMemo, useState } from 'react';
import type { Nav } from '../App';
import { useDecks } from '../state/decks';
import { useToast } from '../components/Toast';
import { ConfirmDialog, Dialog, EmptyState, TopBar } from '../components/ui';
import {
  IconCards,
  IconCopy,
  IconDownload,
  IconPencil,
  IconPlus,
  IconQuiz,
  IconSearch,
  IconTrash,
  IconUpload,
} from '../components/Icons';
import { ExportCancelled, exportJson, pickJsonFile, timestampedName } from '../lib/transfer';
import { usableCards } from '../lib/testgen';
import type { Deck } from '../types';

export default function DeckListScreen({
  nav,
  intent,
}: {
  nav: Nav;
  intent?: 'study' | 'test';
}) {
  const { decks, deleteDeck, duplicateDeck, importFile, exportFile } = useDecks();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Deck | null>(null);
  const [importText, setImportText] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.cards.some((c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)),
    );
  }, [decks, query]);

  const title = intent === 'study' ? 'Study a deck' : intent === 'test' ? 'Test yourself' : 'Your decks';

  async function onExport() {
    try {
      toast(await exportJson(timestampedName(), exportFile()));
    } catch (err) {
      if (err instanceof ExportCancelled) return;
      toast('Export failed', 'bad');
    }
  }

  async function onImport() {
    const raw = await pickJsonFile();
    if (raw === null) return;
    setImportText(raw);
  }

  function runImport(mode: 'merge' | 'replace') {
    if (importText === null) return;
    try {
      const count = importFile(importText, mode);
      toast(count === 0 ? 'No decks found in that file' : `Imported ${count} deck${count === 1 ? '' : 's'}`, count === 0 ? 'bad' : 'good');
    } catch {
      toast('That file is not a Stego deck file', 'bad');
    }
    setImportText(null);
  }

  return (
    <section className="screen">
      <TopBar
        title={title}
        onBack={() => nav.back()}
        actions={
          <div className="row row--tight">
            <button className="btn btn--quiet btn--sm" onClick={onImport} title="Import decks">
              <IconUpload className="btn__icon" />
              <span className="only-wide">Import</span>
            </button>
            <button className="btn btn--quiet btn--sm" onClick={onExport} title="Export decks">
              <IconDownload className="btn__icon" />
              <span className="only-wide">Export</span>
            </button>
            <button className="btn btn--sm" onClick={() => nav.go({ name: 'editor' })}>
              <IconPlus className="btn__icon" />
              <span className="only-wide">New deck</span>
            </button>
          </div>
        }
      />

      <div className="content">
        <div className="wrap stack">
          {decks.length > 3 && (
            <label className="search">
              <IconSearch className="search__icon" />
              <input
                className="input search__input"
                placeholder="Search decks and cards"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          )}

          {decks.length === 0 ? (
            <EmptyState
              title="No decks yet"
              body="Every good dig starts with an empty crate. Make your first deck."
              action={
                <button className="btn" onClick={() => nav.go({ name: 'editor' })}>
                  <IconPlus className="btn__icon" />
                  New deck
                </button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState title="Nothing matched" body={`No deck or card mentions "${query}".`} />
          ) : (
            <ul className="deck-grid">
              {visible.map((deck) => (
                <DeckTile
                  key={deck.id}
                  deck={deck}
                  intent={intent}
                  onStudy={() => nav.go({ name: 'study', deckId: deck.id })}
                  onTest={() => nav.go({ name: 'testSetup', deckId: deck.id })}
                  onEdit={() => nav.go({ name: 'editor', deckId: deck.id })}
                  onDuplicate={() => {
                    duplicateDeck(deck.id);
                    toast('Deck duplicated');
                  }}
                  onDelete={() => setPendingDelete(deck)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.name}"?`}
          body={`This removes ${pendingDelete.cards.length} card${
            pendingDelete.cards.length === 1 ? '' : 's'
          }. Extinction is forever — there is no undo.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteDeck(pendingDelete.id);
            setPendingDelete(null);
            toast('Deck deleted');
          }}
        />
      )}

      {importText !== null && (
        <Dialog
          title="Import decks"
          onClose={() => setImportText(null)}
          footer={
            <>
              <button className="btn btn--quiet" onClick={() => setImportText(null)}>
                Cancel
              </button>
              <span className="spacer" />
              <button className="btn btn--ghost" onClick={() => runImport('replace')}>
                Replace all
              </button>
              <button className="btn" onClick={() => runImport('merge')}>
                Add to my decks
              </button>
            </>
          }
        >
          <p className="muted">
            Add the decks in this file alongside your own, or replace everything you have with it?
          </p>
        </Dialog>
      )}
    </section>
  );
}

function DeckTile({
  deck,
  intent,
  onStudy,
  onTest,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  deck: Deck;
  intent?: 'study' | 'test';
  onStudy: () => void;
  onTest: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const testable = usableCards(deck).length;
  const primary = intent === 'test' ? onTest : onStudy;

  return (
    <li className="deck-tile">
      <button className="deck-tile__main" onClick={primary} disabled={deck.cards.length === 0}>
        <span className="deck-tile__name">{deck.name}</span>
        {deck.description && <span className="deck-tile__desc">{deck.description}</span>}
        <span className="deck-tile__meta">
          <span className="chip">
            {deck.cards.length} {deck.cards.length === 1 ? 'card' : 'cards'}
          </span>
          {testable < deck.cards.length && (
            <span className="chip chip--bad">{deck.cards.length - testable} incomplete</span>
          )}
        </span>
      </button>

      <div className="deck-tile__actions">
        <button
          className="btn btn--ghost btn--sm"
          onClick={onStudy}
          disabled={deck.cards.length === 0}
        >
          <IconCards className="btn__icon" />
          Study
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onTest} disabled={testable === 0}>
          <IconQuiz className="btn__icon" />
          Test
        </button>
        <span className="spacer" />
        <button className="btn btn--quiet btn--icon" onClick={onEdit} title="Edit deck">
          <IconPencil className="btn__icon" />
        </button>
        <button className="btn btn--quiet btn--icon" onClick={onDuplicate} title="Duplicate deck">
          <IconCopy className="btn__icon" />
        </button>
        <button className="btn btn--quiet btn--icon" onClick={onDelete} title="Delete deck">
          <IconTrash className="btn__icon" />
        </button>
      </div>
    </li>
  );
}
