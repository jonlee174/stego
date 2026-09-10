import { useMemo, useState } from 'react';
import type { Nav } from '../App';
import { useDecks } from '../state/decks';
import { useToast } from '../components/Toast';
import { ConfirmDialog, Dialog, EmptyState, TopBar } from '../components/ui';
import { IconShare } from '../components/Icons';
import {
  IconCards,
  IconCheck,
  IconCopy,
  IconRestart,
  IconDownload,
  IconPencil,
  IconPlus,
  IconQuiz,
  IconSearch,
  IconTarget,
  IconTrash,
  IconUpload,
} from '../components/Icons';
import { ExportCancelled, pickJsonFile } from '../lib/transfer';
import { canShare, saveDecksToFiles, shareDecks } from '../lib/share';
import { usableCards } from '../lib/testgen';
import { dueCount } from '../lib/scheduler';
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
  // Null means that step is not on screen.
  const [picking, setPicking] = useState<string[] | null>(null);
  const [exporting, setExporting] = useState<string[] | null>(null);

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

  /** One deck exports under its own name; several travel as a set. */
  function titleFor(deckIds: string[]): string {
    if (deckIds.length !== 1) return 'Stego decks';
    return decks.find((d) => d.id === deckIds[0])?.name ?? 'Stego decks';
  }

  /** Off a phone there is no share sheet, so skip the one-option chooser. */
  function chooseDestination(deckIds: string[]) {
    if (canShare()) setExporting(deckIds);
    else void onSaveToFiles(deckIds);
  }

  async function onSaveToFiles(deckIds: string[]) {
    setExporting(null);
    try {
      toast(await saveDecksToFiles(titleFor(deckIds), exportFile(deckIds)));
    } catch (err) {
      if (err instanceof ExportCancelled) return;
      toast('Could not save the file', 'bad');
    }
  }

  async function onShare(deckIds: string[]) {
    setExporting(null);
    try {
      await shareDecks(titleFor(deckIds), exportFile(deckIds));
    } catch {
      // Dismissing the share sheet lands here too, so stay quiet about it.
    }
  }

  async function onImport() {
    const raw = await pickJsonFile();
    if (raw === null) return;
    try {
      const count = importFile(raw);
      toast(
        count === 0 ? 'No decks found in that file' : `Imported ${count} deck${count === 1 ? '' : 's'}`,
        count === 0 ? 'bad' : 'good',
      );
    } catch {
      toast('That file is not a Stego deck file', 'bad');
    }
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
            <button
              className="btn btn--quiet btn--sm"
              onClick={() => setPicking(decks.map((d) => d.id))}
              disabled={decks.length === 0}
              title="Export decks"
            >
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
                  onStudy={() => nav.go({ name: 'study', deckId: deck.id, mode: 'all' })}
                  onReview={() => nav.go({ name: 'study', deckId: deck.id, mode: 'due' })}
                  onDynamic={() => nav.go({ name: 'study', deckId: deck.id, mode: 'dynamic' })}
                  onTest={() => nav.go({ name: 'testSetup', deckId: deck.id })}
                  onEdit={() => nav.go({ name: 'editor', deckId: deck.id })}
                  onDuplicate={() => {
                    duplicateDeck(deck.id);
                    toast('Deck duplicated');
                  }}
                  onExport={() => chooseDestination([deck.id])}
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
          }. Extinction is forever, and there is no undo.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteDeck(pendingDelete.id);
            setPendingDelete(null);
            toast('Deck deleted');
          }}
        />
      )}

      {picking && (
        <DeckPicker
          decks={decks}
          selected={picking}
          onChange={setPicking}
          onCancel={() => setPicking(null)}
          onConfirm={() => {
            const chosen = picking;
            setPicking(null);
            chooseDestination(chosen);
          }}
        />
      )}

      {exporting && (
        <Dialog
          title={exporting.length === 1 ? `Export "${titleFor(exporting)}"` : 'Export decks'}
          onClose={() => setExporting(null)}
          footer={
            <>
              <span className="spacer" />
              <button className="btn btn--quiet" onClick={() => setExporting(null)}>
                Cancel
              </button>
            </>
          }
        >
          <button
            className="btn btn--ghost btn--block export-choice"
            onClick={() => onSaveToFiles(exporting)}
          >
            <IconDownload className="btn__icon" />
            <span>
              <strong>Save to Files</strong>
              <small>Keep a copy or back your decks up</small>
            </span>
          </button>

          {canShare() && (
            <button
              className="btn btn--ghost btn--block export-choice"
              onClick={() => onShare(exporting)}
            >
              <IconShare className="btn__icon" />
              <span>
                <strong>Share with others</strong>
                <small>Send by Messages, Mail or AirDrop. Opens straight into their Stego.</small>
              </span>
            </button>
          )}
        </Dialog>
      )}

    </section>
  );
}

function DeckPicker({
  decks,
  selected,
  onChange,
  onCancel,
  onConfirm,
}: {
  decks: Deck[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const all = selected.length === decks.length;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <Dialog
      title="Which decks?"
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn--quiet" onClick={onCancel}>
            Cancel
          </button>
          <span className="spacer" />
          <button className="btn" onClick={onConfirm} disabled={selected.length === 0}>
            Export {selected.length}
          </button>
        </>
      }
    >
      <button
        className="btn btn--ghost btn--block picker__row"
        onClick={() => onChange(all ? [] : decks.map((d) => d.id))}
        aria-pressed={all}
      >
        <span className="picker__box">{all && <IconCheck className="btn__icon" />}</span>
        <span className="picker__name">All decks</span>
      </button>

      <ul className="picker__list">
        {decks.map((deck) => {
          const on = selected.includes(deck.id);
          return (
            <li key={deck.id}>
              <button
                className="btn btn--ghost btn--block picker__row"
                onClick={() => toggle(deck.id)}
                aria-pressed={on}
              >
                <span className="picker__box">{on && <IconCheck className="btn__icon" />}</span>
                <span className="picker__name">{deck.name}</span>
                <span className="picker__count">
                  {deck.cards.length} {deck.cards.length === 1 ? 'card' : 'cards'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

function DeckTile({
  deck,
  intent,
  onStudy,
  onReview,
  onDynamic,
  onTest,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
}: {
  deck: Deck;
  intent?: 'study' | 'test';
  onStudy: () => void;
  onReview: () => void;
  onDynamic: () => void;
  onTest: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const testable = usableCards(deck).length;
  const due = dueCount(deck.cards);
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
          {due > 0 && <span className="chip chip--good">{due} due</span>}
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
        <button className="btn btn--ghost btn--sm" onClick={onReview} disabled={due === 0}>
          <IconRestart className="btn__icon" />
          Review{due > 0 ? ` ${due}` : ''}
        </button>
        <button
          className="btn btn--ghost btn--sm"
          onClick={onDynamic}
          disabled={deck.cards.length === 0}
          title="Repeat the cards you miss until none are left"
        >
          <IconTarget className="btn__icon" />
          Dynamic
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
        <button
          className="btn btn--quiet btn--icon"
          onClick={onExport}
          title={canShare() ? 'Share this deck' : 'Export this deck'}
        >
          <IconShare className="btn__icon" />
        </button>
        <button className="btn btn--quiet btn--icon" onClick={onDelete} title="Delete deck">
          <IconTrash className="btn__icon" />
        </button>
      </div>
    </li>
  );
}
