import { useEffect, useMemo, useState } from 'react';
import type { Nav } from '../App';
import { useDeck } from '../state/decks';
import { EmptyState, Segmented, Slider, Stepper, TopBar } from '../components/ui';
import { IconLink, IconPencil, IconPlay, IconScale } from '../components/Icons';
import {
  MAX_MATCHING_GROUP,
  MIN_MATCHING_GROUP,
  cardsUsed,
  clampGroup,
  defaultConfig,
  generateTest,
  usableCards,
  validate,
} from '../lib/testgen';
import type { Direction, Test, TestConfig } from '../types';
import trexArt from '../../assets/images/trex.png';

export default function TestSetupScreen({
  nav,
  deckId,
  initialConfig,
  onStart,
}: {
  nav: Nav;
  deckId: string;
  initialConfig: TestConfig | null;
  onStart: (test: Test, config: TestConfig) => void;
}) {
  const deck = useDeck(deckId);
  const pool = useMemo(() => (deck ? usableCards(deck) : []), [deck]);
  const [config, setConfig] = useState<TestConfig | null>(null);

  useEffect(() => {
    if (!deck) return;
    // Reuse the last setup when returning to the same deck, otherwise start fresh.
    setConfig(
      initialConfig && initialConfig.deckId === deck.id
        ? { ...initialConfig, cardCount: Math.min(initialConfig.cardCount, pool.length) }
        : defaultConfig(deck),
    );
  }, [deck, initialConfig, pool.length]);

  if (!deck) {
    return (
      <section className="screen">
        <TopBar title="Test" onBack={() => nav.back()} />
        <div className="content">
          <EmptyState title="Deck not found" body="It may have been deleted." />
        </div>
      </section>
    );
  }

  if (pool.length === 0) {
    return (
      <section className="screen">
        <TopBar title={deck.name} onBack={() => nav.back()} />
        <div className="content">
          <EmptyState
            title="Nothing to test yet"
            body="A card needs both a front and a back before it can become a question."
            action={
              <button className="btn" onClick={() => nav.go({ name: 'editor', deckId: deck.id })}>
                <IconPencil className="btn__icon" />
                Edit deck
              </button>
            }
          />
        </div>
      </section>
    );
  }

  if (!config) return <section className="screen" />;

  const group = clampGroup(config.matchingGroupSize);
  const used = cardsUsed(config);
  const remaining = Math.max(0, config.cardCount - used);
  const questionCount = config.written + config.truefalse + config.matching;
  const points = config.written + config.truefalse + config.matching * group;
  const issue = validate(deck, config);

  const patch = (next: Partial<TestConfig>) => setConfig({ ...config, ...next });

  /** Trims the mix so it still fits when the card budget or group size shrinks. */
  function fit(base: TestConfig): TestConfig {
    const next = { ...base };
    const size = clampGroup(next.matchingGroupSize);
    while (cardsUsed(next) > next.cardCount) {
      if (next.written > 0) next.written -= 1;
      else if (next.truefalse > 0) next.truefalse -= 1;
      else if (next.matching > 0) next.matching -= 1;
      else break;
    }
    next.matching = Math.min(next.matching, Math.floor(next.cardCount / size));
    return next;
  }

  const applyPreset = (preset: 'quick' | 'balanced' | 'written' | 'full') => {
    const total = pool.length;
    if (preset === 'quick') {
      const n = Math.min(10, total);
      setConfig(
        fit({
          ...config,
          cardCount: n,
          written: Math.max(1, Math.round(n * 0.4)),
          truefalse: total >= 2 ? Math.round(n * 0.3) : 0,
          matching: n >= group ? 1 : 0,
        }),
      );
    } else if (preset === 'balanced') {
      setConfig(fit({ ...config, cardCount: total, ...splitEvenly(total, group, total >= 2) }));
    } else if (preset === 'written') {
      setConfig({ ...config, cardCount: total, written: total, truefalse: 0, matching: 0 });
    } else {
      setConfig(fit({ ...config, cardCount: total }));
    }
  };

  const start = () => {
    if (issue) return;
    onStart(generateTest(deck, config), config);
  };

  return (
    <section className="screen">
      <TopBar title="Build a test" onBack={() => nav.back()} />

      <div className="content">
        <div className="wrap wrap--narrow stack">
          <div className="setup__hero panel">
            <div>
              <p className="eyebrow">Deck</p>
              <h2 className="setup__deck">{deck.name}</h2>
              <p className="muted">
                {pool.length} testable {pool.length === 1 ? 'card' : 'cards'}
                {pool.length < deck.cards.length &&
                  ` · ${deck.cards.length - pool.length} skipped for a blank side`}
              </p>
            </div>
            <img className="setup__mascot" src={trexArt} alt="" />
          </div>

          <div className="panel stack">
            <div className="panel__head">
              <span className="panel__title">Presets</span>
            </div>
            <div className="row row--tight">
              <button className="btn btn--ghost btn--sm" onClick={() => applyPreset('quick')}>
                Quick 10
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => applyPreset('balanced')}>
                Even mix
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => applyPreset('written')}>
                Write-in only
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => applyPreset('full')}>
                Whole deck
              </button>
            </div>
          </div>

          <div className="panel stack">
            <div className="panel__head">
              <span className="panel__title">How much of the deck</span>
            </div>
            <Slider
              label="Cards drawn"
              value={config.cardCount}
              min={1}
              max={pool.length}
              suffix={`of ${pool.length} (${Math.round((config.cardCount / pool.length) * 100)}%)`}
              onChange={(n) => setConfig(fit({ ...config, cardCount: n }))}
              note="Cards are drawn at random from the deck each time you start a test."
            />
          </div>

          <div className="panel stack">
            <div className="panel__head">
              <span className="panel__title">Question mix</span>
              <span className="spacer" />
              <span className={remaining === 0 ? 'chip chip--good' : 'chip'}>
                {remaining} card{remaining === 1 ? '' : 's'} unused
              </span>
            </div>

            <Stepper
              label="Write-in"
              sub="Type the answer"
              icon={<IconPencil className="btn__icon" />}
              value={config.written}
              min={0}
              max={config.written + remaining}
              onChange={(n) => patch({ written: n })}
            />

            <Stepper
              label="True / False"
              sub={pool.length < 2 ? 'Needs at least two cards' : 'Judge a pairing'}
              icon={<IconScale className="btn__icon" />}
              value={config.truefalse}
              min={0}
              max={pool.length < 2 ? 0 : config.truefalse + remaining}
              disabled={pool.length < 2}
              onChange={(n) => patch({ truefalse: n })}
            />

            <Stepper
              label="Matching"
              sub={`${group} pairs per block`}
              icon={<IconLink className="btn__icon" />}
              value={config.matching}
              min={0}
              max={Math.floor((config.matching * group + remaining) / group)}
              disabled={config.cardCount < MIN_MATCHING_GROUP}
              onChange={(n) => patch({ matching: n })}
            />

            {config.matching > 0 && (
              <Slider
                label="Pairs per matching block"
                value={group}
                min={MIN_MATCHING_GROUP}
                max={Math.max(
                  MIN_MATCHING_GROUP,
                  Math.min(MAX_MATCHING_GROUP, config.cardCount),
                )}
                onChange={(n) => setConfig(fit({ ...config, matchingGroupSize: n }))}
              />
            )}
          </div>

          <div className="panel stack">
            <div className="panel__head">
              <span className="panel__title">Direction</span>
            </div>
            <Segmented<Direction>
              value={config.direction}
              onChange={(v) => patch({ direction: v })}
              options={[
                { value: 'front-to-back', label: 'Front → Back' },
                { value: 'back-to-front', label: 'Back → Front' },
                { value: 'mixed', label: 'Mixed' },
              ]}
            />
            <p className="hint">
              Front → Back asks with the prompt side and expects the answer side. Flip it to be
              asked the other way around.
            </p>
          </div>

          <div className="setup__summary">
            <div>
              <p className="eyebrow">Your test</p>
              <p className="setup__summary-line">
                <strong>{questionCount}</strong> question{questionCount === 1 ? '' : 's'} ·{' '}
                <strong>{points}</strong> point{points === 1 ? '' : 's'}
              </p>
              {issue && <p className="setup__warn">{issue.message}</p>}
            </div>
            <button className="btn setup__start" onClick={start} disabled={!!issue}>
              <IconPlay className="btn__icon" />
              Start test
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Roughly equal thirds of the card budget across the three question types. */
function splitEvenly(total: number, group: number, allowTrueFalse: boolean) {
  const matching = Math.max(0, Math.floor(total / 3 / group));
  const left = total - matching * group;
  const written = allowTrueFalse ? Math.ceil(left / 2) : left;
  return { written, truefalse: left - written, matching };
}
