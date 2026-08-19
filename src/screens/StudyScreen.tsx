import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Nav } from '../App';
import { useDeck } from '../state/decks';
import { EmptyState, Segmented, TopBar } from '../components/ui';
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconRestart,
  IconShuffle,
  IconX,
} from '../components/Icons';
import { shuffle } from '../lib/random';
import type { Card, Direction } from '../types';

type Verdict = 'known' | 'again';

export default function StudyScreen({ nav, deckId }: { nav: Nav; deckId: string }) {
  const deck = useDeck(deckId);
  const [order, setOrder] = useState<Card[]>(() => deck?.cards ?? []);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [side, setSide] = useState<Direction>('front-to-back');
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setOrder(deck?.cards ?? []);
    setIndex(0);
    setFlipped(false);
    setVerdicts({});
  }, [deck?.id, deck?.cards]);

  const total = order.length;
  const card = order[index];
  const done = total > 0 && Object.keys(verdicts).length === total;

  const go = useCallback(
    (delta: number) => {
      setFlipped(false);
      setIndex((prev) => Math.min(Math.max(prev + delta, 0), Math.max(total - 1, 0)));
    },
    [total],
  );

  const mark = useCallback(
    (verdict: Verdict) => {
      if (!card) return;
      setVerdicts((prev) => ({ ...prev, [card.id]: verdict }));
      if (index < total - 1) go(1);
      else setFlipped(false);
    },
    [card, go, index, total],
  );

  const reshuffle = useCallback(() => {
    setOrder((prev) => shuffle(prev));
    setIndex(0);
    setFlipped(false);
  }, []);

  const restart = useCallback(() => {
    setOrder(deck?.cards ?? []);
    setIndex(0);
    setFlipped(false);
    setVerdicts({});
  }, [deck?.cards]);

  const reviewMissed = useCallback(() => {
    const missed = order.filter((c) => verdicts[c.id] === 'again');
    if (missed.length === 0) return;
    setOrder(shuffle(missed));
    setIndex(0);
    setFlipped(false);
    setVerdicts({});
  }, [order, verdicts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === '1') mark('again');
      else if (e.key === '2') mark('known');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, mark]);

  const counts = useMemo(() => {
    const values = Object.values(verdicts);
    return {
      known: values.filter((v) => v === 'known').length,
      again: values.filter((v) => v === 'again').length,
    };
  }, [verdicts]);

  if (!deck) {
    return (
      <section className="screen">
        <TopBar title="Study" onBack={() => nav.back()} />
        <div className="content">
          <EmptyState title="Deck not found" body="It may have been deleted." />
        </div>
      </section>
    );
  }

  if (total === 0) {
    return (
      <section className="screen">
        <TopBar title={deck.name} onBack={() => nav.back()} />
        <div className="content">
          <EmptyState
            title="This deck is empty"
            body="Add a few cards and the herd will be ready to study."
            action={
              <button className="btn" onClick={() => nav.go({ name: 'editor', deckId: deck.id })}>
                Add cards
              </button>
            }
          />
        </div>
      </section>
    );
  }

  const showBackFirst =
    side === 'back-to-front' || (side === 'mixed' && index % 2 === 1);
  const face = showBackFirst ? card.back : card.front;
  const reverse = showBackFirst ? card.front : card.back;
  const progress = ((index + 1) / total) * 100;

  return (
    <section className="screen study">
      <TopBar
        title={deck.name}
        onBack={() => nav.back()}
        actions={
          <div className="row row--tight">
            <button className="btn btn--quiet btn--icon" onClick={reshuffle} title="Shuffle deck">
              <IconShuffle className="btn__icon" />
            </button>
            <button className="btn btn--quiet btn--icon" onClick={restart} title="Start over">
              <IconRestart className="btn__icon" />
            </button>
          </div>
        }
      />

      <div className="content study__content">
        <div className="wrap wrap--narrow stack study__stack">
          <div className="study__meter">
            <div className="study__meter-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="row study__status">
            <span className="eyebrow">
              Card {index + 1} of {total}
            </span>
            <span className="spacer" />
            <span className="chip chip--good">{counts.known} known</span>
            <span className="chip chip--bad">{counts.again} to review</span>
          </div>

          <div
            className={flipped ? 'flashcard is-flipped' : 'flashcard'}
            onClick={() => setFlipped((f) => !f)}
            onTouchStart={(e) => {
              const t = e.touches[0];
              touchStart.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={(e) => {
              const start = touchStart.current;
              touchStart.current = null;
              if (!start) return;
              const t = e.changedTouches[0];
              const dx = t.clientX - start.x;
              const dy = t.clientY - start.y;
              // Horizontal swipes page through the deck; taps still flip.
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                e.preventDefault();
                go(dx < 0 ? 1 : -1);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Flashcard — click to flip"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setFlipped((f) => !f);
              }
            }}
          >
            <div className="flashcard__inner">
              <div className="flashcard__face flashcard__face--front">
                <span className="flashcard__tag">{showBackFirst ? 'Back' : 'Front'}</span>
                <p className="flashcard__text">{face}</p>
                <span className="flashcard__hint">Tap to flip</span>
              </div>
              <div className="flashcard__face flashcard__face--back">
                <span className="flashcard__tag">{showBackFirst ? 'Front' : 'Back'}</span>
                <p className="flashcard__text">{reverse}</p>
                <span className="flashcard__hint">Tap to flip back</span>
              </div>
            </div>
          </div>

          <div className="row study__verdicts">
            <button className="btn btn--ghost study__verdict" onClick={() => mark('again')}>
              <IconX className="btn__icon" />
              Review again
            </button>
            <button className="btn study__verdict" onClick={() => mark('known')}>
              <IconCheck className="btn__icon" />
              Got it
            </button>
          </div>

          <div className="row study__nav">
            <button
              className="btn btn--quiet btn--icon"
              onClick={() => go(-1)}
              disabled={index === 0}
              aria-label="Previous card"
            >
              <IconChevronLeft className="btn__icon" />
            </button>
            <div className="study__dots" aria-hidden="true">
              {order.map((c, i) => (
                <span
                  key={c.id}
                  className={[
                    'study__dot',
                    i === index ? 'is-current' : '',
                    verdicts[c.id] === 'known' ? 'is-known' : '',
                    verdicts[c.id] === 'again' ? 'is-again' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              ))}
            </div>
            <button
              className="btn btn--quiet btn--icon"
              onClick={() => go(1)}
              disabled={index >= total - 1}
              aria-label="Next card"
            >
              <IconChevronRight className="btn__icon" />
            </button>
          </div>

          {done && (
            <div className="panel study__summary">
              <h2 className="panel__title">Round complete</h2>
              <p className="muted">
                {counts.known} known, {counts.again} still to review.
              </p>
              <div className="row">
                <button
                  className="btn"
                  onClick={reviewMissed}
                  disabled={counts.again === 0}
                >
                  <IconRestart className="btn__icon" />
                  Review the {counts.again} you missed
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => nav.go({ name: 'testSetup', deckId: deck.id })}
                >
                  Take a test
                </button>
              </div>
            </div>
          )}

          <Segmented<Direction>
            label="Show first"
            value={side}
            onChange={(v) => {
              setSide(v);
              setFlipped(false);
            }}
            options={[
              { value: 'front-to-back', label: 'Front' },
              { value: 'back-to-front', label: 'Back' },
              { value: 'mixed', label: 'Mixed' },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
