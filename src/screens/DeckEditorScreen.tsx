import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Nav } from '../App';
import { newCard, useDeck, useDecks } from '../state/decks';
import { useToast } from '../components/Toast';
import { ConfirmDialog, TopBar } from '../components/ui';
import { IconFlip, IconPlus, IconSave, IconTrash } from '../components/Icons';
import type { Card } from '../types';

export default function DeckEditorScreen({ nav, deckId }: { nav: Nav; deckId?: string }) {
  const existing = useDeck(deckId);
  const { createDeck, updateDeck } = useDecks();
  const toast = useToast();

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [cards, setCards] = useState<Card[]>(
    existing ? existing.cards.map((c) => ({ ...c })) : [newCard(), newCard(), newCard()],
  );
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const lastRowRef = useRef<HTMLTextAreaElement | null>(null);
  const focusLast = useRef(false);

  useEffect(() => {
    if (focusLast.current && lastRowRef.current) {
      lastRowRef.current.focus();
      focusLast.current = false;
    }
  }, [cards.length]);

  const filled = useMemo(
    () => cards.filter((c) => c.front.trim() !== '' || c.back.trim() !== ''),
    [cards],
  );

  const touch = () => setDirty(true);

  const setCard = (id: string, patch: Partial<Card>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    touch();
  };

  const addCard = () => {
    focusLast.current = true;
    setCards((prev) => [...prev, newCard()]);
    touch();
  };

  const removeCard = (id: string) => {
    setCards((prev) => (prev.length === 1 ? [newCard()] : prev.filter((c) => c.id !== id)));
    touch();
  };

  const swapSides = (id: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, front: c.back, back: c.front } : c)),
    );
    touch();
  };

  const save = useCallback(() => {
    if (name.trim() === '') {
      toast('Give the deck a title first', 'bad');
      return;
    }
    // Blank rows are scaffolding, not cards — drop them on the way out.
    const keep = cards
      .filter((c) => c.front.trim() !== '' || c.back.trim() !== '')
      .map((c) => ({ ...c, front: c.front.trim(), back: c.back.trim() }));

    if (existing) {
      updateDeck(existing.id, { name: name.trim(), description: description.trim(), cards: keep });
      toast('Deck saved');
    } else {
      createDeck(name, description, keep);
      toast(`Created "${name.trim()}"`);
    }
    setDirty(false);
    nav.back();
  }, [cards, createDeck, description, existing, name, nav, toast, updateDeck]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const leave = () => {
    if (dirty) setConfirmLeave(true);
    else nav.back();
  };

  return (
    <section className="screen">
      <TopBar
        title={existing ? 'Edit deck' : 'New deck'}
        onBack={leave}
        backLabel="Back"
        actions={
          <button className="btn btn--sm" onClick={save} disabled={name.trim() === ''}>
            <IconSave className="btn__icon" />
            Save
          </button>
        }
      />

      <div className="content">
        <div className="wrap wrap--narrow stack">
          <div className="panel stack">
            <label className="field">
              <span className="field__label">Title</span>
              <input
                className="input"
                value={name}
                autoFocus={!existing}
                placeholder="e.g. Jurassic Period"
                onChange={(e) => {
                  setName(e.target.value);
                  touch();
                }}
              />
            </label>
            <label className="field">
              <span className="field__label">Description</span>
              <textarea
                className="textarea"
                value={description}
                placeholder="What is this deck for?"
                onChange={(e) => {
                  setDescription(e.target.value);
                  touch();
                }}
              />
            </label>
          </div>

          <div className="row">
            <span className="eyebrow">
              {filled.length} {filled.length === 1 ? 'card' : 'cards'}
            </span>
            <span className="spacer" />
            <span className="hint">Front is the prompt · back is the answer</span>
          </div>

          <ol className="card-rows">
            {cards.map((card, i) => (
              <li className="card-row" key={card.id}>
                <div className="card-row__num">{i + 1}</div>
                <div className="card-row__fields">
                  <label className="field">
                    <span className="field__label">Front</span>
                    <textarea
                      className="textarea card-row__input"
                      value={card.front}
                      rows={2}
                      ref={i === cards.length - 1 ? lastRowRef : undefined}
                      onChange={(e) => setCard(card.id, { front: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Back</span>
                    <textarea
                      className="textarea card-row__input"
                      value={card.back}
                      rows={2}
                      onChange={(e) => setCard(card.id, { back: e.target.value })}
                    />
                  </label>
                </div>
                <div className="card-row__tools">
                  <button
                    className="btn btn--quiet btn--icon"
                    onClick={() => swapSides(card.id)}
                    title="Swap front and back"
                  >
                    <IconFlip className="btn__icon" />
                  </button>
                  <button
                    className="btn btn--quiet btn--icon"
                    onClick={() => removeCard(card.id)}
                    title="Remove card"
                  >
                    <IconTrash className="btn__icon" />
                  </button>
                </div>
              </li>
            ))}
          </ol>

          <button className="btn btn--ghost btn--block" onClick={addCard}>
            <IconPlus className="btn__icon" />
            Add card
          </button>

          <p className="hint">
            Tip: separate interchangeable answers with a semicolon — <code>T. rex; Tyrannosaurus</code>{' '}
            — and a written answer counts as correct if it matches either one.
          </p>
        </div>
      </div>

      {confirmLeave && (
        <ConfirmDialog
          title="Discard changes?"
          body="This deck has edits that have not been saved."
          confirmLabel="Discard"
          onCancel={() => setConfirmLeave(false)}
          onConfirm={() => {
            setConfirmLeave(false);
            nav.back();
          }}
        />
      )}
    </section>
  );
}
