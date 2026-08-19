import { useMemo } from 'react';
import type { Nav } from '../App';
import { useDeck } from '../state/decks';
import { TopBar } from '../components/ui';
import { IconCards, IconCheck, IconRestart, IconTrophy, IconX } from '../components/Icons';
import { generateTest } from '../lib/testgen';
import { gradeWritten, normalize, questionWeight } from '../lib/grading';
import type { GradedQuestion, Test, TestConfig, TestResult } from '../types';
import stegoArt from '../../assets/images/stego.png';
import trexArt from '../../assets/images/trex.png';

export default function TestResultsScreen({
  nav,
  result,
  lastConfig,
  onRetake,
}: {
  nav: Nav;
  result: TestResult;
  lastConfig: TestConfig | null;
  onRetake: (test: Test, config: TestConfig) => void;
}) {
  const deck = useDeck(result.test.deckId);
  const percent = Math.round(result.percent);

  const byType = useMemo(() => {
    const groups: Record<string, { earned: number; possible: number }> = {};
    for (const g of result.graded) {
      const key = g.question.type;
      const weight = questionWeight(g.question);
      groups[key] ??= { earned: 0, possible: 0 };
      groups[key].earned += g.score * weight;
      groups[key].possible += weight;
    }
    return groups;
  }, [result]);

  const missed = result.graded.filter((g) => g.score < 1);

  const retake = () => {
    if (!deck || !lastConfig) return;
    onRetake(generateTest(deck, lastConfig), lastConfig);
  };

  return (
    <section className="screen">
      <TopBar title="Results" onBack={() => nav.go({ name: 'home' })} backLabel="Home" />

      <div className="content">
        <div className="wrap wrap--narrow stack">
          <div className={`score score--${band(percent)}`}>
            <img className="score__art" src={percent >= 70 ? stegoArt : trexArt} alt="" />
            <div className="score__body">
              <p className="eyebrow">{result.test.deckName}</p>
              <p className="score__value">{percent}%</p>
              <p className="score__detail">
                {round(result.earned)} of {result.possible} points
              </p>
              <p className="score__verdict">{verdict(percent)}</p>
            </div>
          </div>

          <div className="breakdown">
            {Object.entries(byType).map(([type, stat]) => (
              <div className="breakdown__cell" key={type}>
                <p className="eyebrow">{label(type)}</p>
                <p className="breakdown__value">
                  {round(stat.earned)}/{stat.possible}
                </p>
                <div className="breakdown__bar">
                  <span style={{ width: `${(stat.earned / stat.possible) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="row">
            <button className="btn" onClick={retake} disabled={!deck || !lastConfig}>
              <IconRestart className="btn__icon" />
              Retake
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => deck && nav.go({ name: 'study', deckId: deck.id })}
              disabled={!deck}
            >
              <IconCards className="btn__icon" />
              Study the deck
            </button>
            <span className="spacer" />
            <button className="btn btn--quiet" onClick={() => nav.go({ name: 'home' })}>
              Done
            </button>
          </div>

          <div className="panel__head">
            <span className="panel__title">
              {missed.length === 0
                ? 'Every question correct'
                : `Review · ${missed.length} to look at`}
            </span>
          </div>

          <ol className="review">
            {result.graded.map((g, i) => (
              <ReviewItem key={g.question.id} graded={g} number={i + 1} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function ReviewItem({ graded, number }: { graded: GradedQuestion; number: number }) {
  const { question, given, score } = graded;
  const state = score >= 1 ? 'right' : score > 0 ? 'partial' : 'wrong';

  return (
    <li className={`review__item is-${state}`}>
      <div className="review__head">
        <span className="review__num">{number}</span>
        <span className={state === 'right' ? 'chip chip--good' : 'chip chip--bad'}>
          {state === 'right' ? (
            <IconCheck className="btn__icon" />
          ) : state === 'partial' ? (
            <IconTrophy className="btn__icon" />
          ) : (
            <IconX className="btn__icon" />
          )}
          {state === 'right' ? 'Correct' : state === 'partial' ? 'Partly correct' : 'Missed'}
        </span>
        <span className="spacer" />
        <span className="muted">
          {round(score * questionWeight(question))}/{questionWeight(question)}
        </span>
      </div>

      {question.type === 'written' && (
        <>
          <p className="review__prompt">{question.prompt}</p>
          <AnswerLine
            label="You wrote"
            text={typeof given === 'string' && given.trim() ? given : '— blank —'}
            ok={score >= 1}
          />
          {score >= 1 &&
            typeof given === 'string' &&
            gradeWritten(given, question.answer).fuzzy && (
              <p className="hint">Close enough — a small typo was accepted.</p>
            )}
          {score < 1 && <AnswerLine label="Answer" text={question.answer} ok />}
        </>
      )}

      {question.type === 'truefalse' && (
        <>
          <p className="review__prompt">
            {question.prompt} <span className="review__joiner">is paired with</span>{' '}
            {question.claim}
          </p>
          <AnswerLine
            label="You said"
            text={given === undefined ? '— blank —' : given ? 'True' : 'False'}
            ok={score >= 1}
          />
          {score < 1 && <AnswerLine label="Answer" text={question.answer ? 'True' : 'False'} ok />}
        </>
      )}

      {question.type === 'matching' && (
        <ul className="review__pairs">
          {question.pairs.map((pair) => {
            const picks = (given as Record<string, string> | undefined) ?? {};
            const pick = picks[pair.cardId] ?? '';
            const ok = normalize(pick) === normalize(pair.answer);
            return (
              <li key={pair.cardId} className={ok ? 'review__pair is-ok' : 'review__pair is-off'}>
                <span className="review__pair-prompt">{pair.prompt}</span>
                <span className="review__pair-given">{pick || '— blank —'}</span>
                {!ok && <span className="review__pair-answer">{pair.answer}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function AnswerLine({ label, text, ok }: { label: string; text: string; ok: boolean }) {
  return (
    <p className={ok ? 'answer-line is-ok' : 'answer-line is-off'}>
      <span className="eyebrow">{label}</span>
      {text}
    </p>
  );
}

function label(type: string): string {
  return type === 'written' ? 'Write-in' : type === 'truefalse' ? 'True / False' : 'Matching';
}

function band(percent: number): 'high' | 'mid' | 'low' {
  if (percent >= 85) return 'high';
  if (percent >= 60) return 'mid';
  return 'low';
}

function verdict(percent: number): string {
  if (percent === 100) return 'Flawless. Museum quality.';
  if (percent >= 85) return 'Strong footing — the herd is impressed.';
  if (percent >= 70) return 'Solid. A few plates still to grow.';
  if (percent >= 50) return 'Halfway out of the tar pit.';
  return 'Back to the dig site.';
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
