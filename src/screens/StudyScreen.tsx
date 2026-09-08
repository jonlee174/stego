import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Nav } from '../App';
import { useDeck, useDecks } from '../state/decks';
import { EmptyState, Segmented, TopBar } from '../components/ui';
import { Confetti } from '../components/Confetti';
import { useToast } from '../components/Toast';
import {
  IconChevronLeft,
  IconChevronRight,
  IconRestart,
  IconShuffle,
} from '../components/Icons';
import { shuffle } from '../lib/random';
import { describeNext, dueCards, gradeFor, isLeech, schedule, type Difficulty } from '../lib/scheduler';
import {
  answer as answerCard,
  createSession,
  currentCard,
  isComplete,
  progress as sessionProgress,
  retire,
  type Session,
} from '../lib/session';
import type { Card, Direction, StudyMode } from '../types';

/** Missed first, known second, matching the keyboard order. */
const RATINGS: { value: Difficulty; label: string; key: string }[] = [
  { value: 'again', label: 'Again', key: '1' },
  { value: 'good', label: 'Good', key: '2' },
];

const MODES: { value: StudyMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due' },
  { value: 'dynamic', label: 'Dynamic' },
];

/** Which cards a mode starts with. */
function selectCards(cards: Card[], mode: StudyMode): Card[] {
  return mode === 'due' ? dueCards(cards) : cards;
}

export default function StudyScreen({
  nav,
  deckId,
  mode: initialMode,
}: {
  nav: Nav;
  deckId: string;
  mode?: StudyMode;
}) {
  const deck = useDeck(deckId);
  const { reviewCard } = useDecks();
  const toast = useToast();
  const [mode, setMode] = useState<StudyMode>(initialMode ?? 'all');
  const [order, setOrder] = useState<Card[]>(() =>
    selectCards(deck?.cards ?? [], initialMode ?? 'all'),
  );
  const [session, setSession] = useState<Session>(() =>
    createSession(selectCards(deck?.cards ?? [], initialMode ?? 'all')),
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [side, setSide] = useState<Direction>('front-to-back');
  const [verdicts, setVerdicts] = useState<Record<string, Difficulty>>({});
  const [cheered, setCheered] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const dynamic = mode === 'dynamic';

  const reset = useCallback((cards: Card[]) => {
    setOrder(cards);
    setSession(createSession(cards));
    setIndex(0);
    setFlipped(false);
    setVerdicts({});
    setCheered(false);
  }, []);

  // Only reset when a different deck or mode is picked. Keying this on
  // deck.cards would restart the run on every review, since recording one
  // rewrites the deck.
  useEffect(() => {
    reset(selectCards(deck?.cards ?? [], mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck?.id, mode]);

  const card = dynamic ? currentCard(session) : order[index];
  const total = dynamic ? session.size : order.length;
  const cleared = dynamic && total > 0 && isComplete(session);
  const done = !dynamic && total > 0 && Object.keys(verdicts).length === total;

  const go = useCallback(
    (delta: number) => {
      setFlipped(false);
      setIndex((prev) => Math.min(Math.max(prev + delta, 0), Math.max(order.length - 1, 0)));
    },
    [order.length],
  );

  const mark = useCallback(
    (difficulty: Difficulty) => {
      if (!card) return;
      reviewCard(deckId, card.id, difficulty);
      setVerdicts((prev) => ({ ...prev, [card.id]: difficulty }));

      if (dynamic) {
        setSession((prev) => answerCard(prev, difficulty));
        setFlipped(false);
        // Within a dynamic run, when the card comes back matters more than
        // when the schedule next asks for it.
        if (difficulty === 'again') toast('Coming back in a moment');
        else toast(`Back ${describeNext(schedule(card.review, gradeFor(difficulty)))}`);
        return;
      }

      toast(`Back ${describeNext(schedule(card.review, gradeFor(difficulty)))}`);
      if (index < order.length - 1) go(1);
      else setFlipped(false);
    },
    [card, dynamic, go, index, order.length, reviewCard, deckId, toast],
  );

  /** "I know this one after all": clears it from the run for good. */
  const clearIt = useCallback(() => {
    if (!card) return;
    reviewCard(deckId, card.id, 'good');
    setVerdicts((prev) => ({ ...prev, [card.id]: 'good' }));
    setSession((prev) => retire(prev, card.id));
    setFlipped(false);
    toast('Cleared from this run');
  }, [card, deckId, reviewCard, toast]);

  const reshuffle = useCallback(() => {
    if (dynamic) {
      setSession((prev) => ({ ...prev, queue: shuffle(prev.queue) }));
      setFlipped(false);
      return;
    }
    setOrder((prev) => shuffle(prev));
    setIndex(0);
    setFlipped(false);
  }, [dynamic]);

  const restart = useCallback(() => {
    reset(selectCards(deck?.cards ?? [], mode));
  }, [deck?.cards, mode, reset]);

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
      } else if (e.key === 'ArrowRight' && !dynamic) go(1);
      else if (e.key === 'ArrowLeft' && !dynamic) go(-1);
      else {
        const rating = RATINGS.find((r) => r.key === e.key);
        if (rating) mark(rating.value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dynamic, go, mark]);

  const counts = useMemo(() => {
    const values = Object.values(verdicts);
    return {
      known: values.filter((v) => v !== 'again').length,
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

  if (deck.cards.length === 0) {
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

  if (total === 0) {
    return (
      <section className="screen">
        <TopBar title={deck.name} onBack={() => nav.back()} />
        <div className="content">
          <div className="wrap wrap--narrow stack">
            <EmptyState
              title="Nothing due right now"
              body="The whole deck is scheduled for later. Study it anyway, or come back when it is due."
              action={
                <button className="btn" onClick={() => setMode('all')}>
                  Study all cards
                </button>
              }
            />
          </div>
        </div>
      </section>
    );
  }

  // Mixed alternates by the card's place in the deck, since a dynamic run has
  // no running index of its own.
  const seq = dynamic ? order.findIndex((c) => c.id === card?.id) : index;
  const showBackFirst = side === 'back-to-front' || (side === 'mixed' && seq % 2 === 1);
  const face = card ? (showBackFirst ? card.back : card.front) : '';
  const reverse = card ? (showBackFirst ? card.front : card.back) : '';
  const percent = dynamic ? sessionProgress(session) * 100 : ((index + 1) / total) * 100;
  const struggling = dynamic && card ? session.struggled.includes(card.id) : false;

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
          <Segmented<StudyMode> label="Mode" value={mode} onChange={setMode} options={MODES} />

          <div className="study__meter">
            <div className="study__meter-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="row study__status">
            <span className="eyebrow">
              {dynamic
                ? `${session.cleared.length} of ${total} cleared`
                : `Card ${index + 1} of ${total}`}
            </span>
            <span className="spacer" />
            {dynamic ? (
              <>
                <span className="chip chip--good">{session.queue.length} left</span>
                {session.struggled.length > 0 && (
                  <span className="chip chip--bad">{session.struggled.length} repeated</span>
                )}
              </>
            ) : (
              <>
                <span className="chip chip--good">{counts.known} known</span>
                <span className="chip chip--bad">{counts.again} to review</span>
              </>
            )}
          </div>

          {dynamic && (
            <p className="hint">Cards you rate Again come back until you rate them Good.</p>
          )}

          {card && (
            <>
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
                  if (!start || dynamic) return;
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
                aria-label="Flashcard, click to flip"
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
                    {isLeech(card.review) && (
                      <span className="flashcard__leech">Missed often. Worth rewording.</span>
                    )}
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
                {RATINGS.map((rating) => (
                  <button
                    key={rating.value}
                    className={`btn study__verdict study__verdict--${rating.value}`}
                    onClick={() => mark(rating.value)}
                    title={`${rating.label} (${rating.key})`}
                  >
                    {rating.label}
                  </button>
                ))}
              </div>

              {struggling && (
                <button className="btn btn--quiet btn--block" onClick={clearIt}>
                  I know this one, stop showing it
                </button>
              )}
            </>
          )}

          {!dynamic && (
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
                      verdicts[c.id] && verdicts[c.id] !== 'again' ? 'is-known' : '',
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
          )}

          {dynamic && (
            <div className="study__dots study__dots--own-row" aria-hidden="true">
              {order.map((c) => (
                <span
                  key={c.id}
                  className={[
                    'study__dot',
                    card?.id === c.id ? 'is-current' : '',
                    session.cleared.includes(c.id) ? 'is-known' : '',
                    session.struggled.includes(c.id) ? 'is-again' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              ))}
            </div>
          )}

          {cleared && (
            <div className="panel study__summary">
              <h2 className="panel__title">Whole deck cleared</h2>
              <p className="muted">
                {total} {total === 1 ? 'card' : 'cards'} seen, and nothing is still coming back.
              </p>
              <div className="row">
                <button className="btn" onClick={restart}>
                  <IconRestart className="btn__icon" />
                  Run it again
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

          {done && (
            <div className="panel study__summary">
              <h2 className="panel__title">Round complete</h2>
              <p className="muted">
                {counts.known} known, {counts.again} still to review.
              </p>
              <div className="row">
                <button className="btn" onClick={reviewMissed} disabled={counts.again === 0}>
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

      {cleared && !cheered && <Confetti onDone={() => setCheered(true)} />}
    </section>
  );
}
