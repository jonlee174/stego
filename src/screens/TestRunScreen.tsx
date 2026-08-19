import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Nav } from '../App';
import { ConfirmDialog, TopBar } from '../components/ui';
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconLink,
  IconPencil,
  IconScale,
  IconX,
} from '../components/Icons';
import { gradeTest, questionWeight } from '../lib/grading';
import type { Question, ResponseMap, Test, TestResult } from '../types';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function TestRunScreen({
  nav,
  test,
  onFinish,
}: {
  nav: Nav;
  test: Test;
  onFinish: (result: TestResult) => void;
}) {
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const total = test.questions.length;
  const question = test.questions[index];

  const answered = useCallback(
    (q: Question) => {
      const value = responses[q.id];
      if (value === undefined) return false;
      if (q.type === 'matching') {
        const picks = value as Record<string, string>;
        return q.pairs.every((p) => picks[p.cardId]);
      }
      if (q.type === 'written') return String(value).trim() !== '';
      return true;
    },
    [responses],
  );

  const unanswered = useMemo(
    () => test.questions.filter((q) => !answered(q)).length,
    [answered, test.questions],
  );

  const setAnswer = (id: string, value: ResponseMap[string]) =>
    setResponses((prev) => ({ ...prev, [id]: value }));

  const go = (delta: number) =>
    setIndex((prev) => Math.min(Math.max(prev + delta, 0), total - 1));

  const submit = useCallback(() => {
    onFinish(gradeTest(test, responses));
  }, [onFinish, responses, test]);

  const trySubmit = () => {
    if (unanswered > 0) setConfirmSubmit(true);
    else submit();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'ArrowRight' && !typing) go(1);
      if (e.key === 'ArrowLeft' && !typing) go(-1);
      if (e.key === 'Enter' && index < total - 1) go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, total]);

  const progress = (test.questions.filter(answered).length / total) * 100;

  return (
    <section className="screen">
      <TopBar
        title={test.deckName}
        onBack={() => setConfirmQuit(true)}
        backLabel="Quit"
        actions={
          <span className="chip">
            {index + 1} / {total}
          </span>
        }
      />

      <div className="content">
        <div className="wrap wrap--narrow stack">
          <div className="study__meter">
            <div className="study__meter-fill" style={{ width: `${progress}%` }} />
          </div>

          <nav className="qnav" aria-label="Questions">
            {test.questions.map((q, i) => (
              <button
                key={q.id}
                className={[
                  'qnav__pip',
                  i === index ? 'is-current' : '',
                  answered(q) ? 'is-done' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setIndex(i)}
                aria-label={`Question ${i + 1}${answered(q) ? ', answered' : ''}`}
                aria-current={i === index}
              >
                {i + 1}
              </button>
            ))}
          </nav>

          <QuestionCard
            key={question.id}
            question={question}
            number={index + 1}
            value={responses[question.id]}
            onChange={(value) => setAnswer(question.id, value)}
          />

          <div className="row runner__nav">
            <button
              className="btn btn--ghost"
              onClick={() => go(-1)}
              disabled={index === 0}
            >
              <IconChevronLeft className="btn__icon" />
              Back
            </button>
            <span className="spacer" />
            {index < total - 1 ? (
              <button className="btn" onClick={() => go(1)}>
                Next
                <IconChevronRight className="btn__icon" />
              </button>
            ) : (
              <button className="btn" onClick={trySubmit}>
                <IconCheck className="btn__icon" />
                Submit test
              </button>
            )}
          </div>

          {index === total - 1 || unanswered === 0 ? null : (
            <p className="hint runner__hint">
              {unanswered} question{unanswered === 1 ? '' : 's'} still blank.
            </p>
          )}

          {index < total - 1 && (
            <button className="btn btn--quiet btn--block" onClick={trySubmit}>
              Submit early
            </button>
          )}
        </div>
      </div>

      {confirmSubmit && (
        <ConfirmDialog
          title="Submit with blanks?"
          body={`${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered. Blank answers are marked wrong.`}
          confirmLabel="Submit anyway"
          onCancel={() => setConfirmSubmit(false)}
          onConfirm={() => {
            setConfirmSubmit(false);
            submit();
          }}
        />
      )}

      {confirmQuit && (
        <ConfirmDialog
          title="Quit this test?"
          body="Your answers so far will be discarded."
          confirmLabel="Quit"
          onCancel={() => setConfirmQuit(false)}
          onConfirm={() => {
            setConfirmQuit(false);
            nav.back();
          }}
        />
      )}
    </section>
  );
}

function QuestionCard({
  question,
  number,
  value,
  onChange,
}: {
  question: Question;
  number: number;
  value: ResponseMap[string] | undefined;
  onChange: (value: ResponseMap[string]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Written questions get the caret straight away on desktop; on touch the
    // keyboard only appears once the field is tapped.
    if (question.type === 'written' && window.matchMedia('(pointer: fine)').matches) {
      inputRef.current?.focus();
    }
  }, [question]);

  const meta = {
    written: { label: 'Write-in', icon: <IconPencil className="btn__icon" /> },
    truefalse: { label: 'True or false', icon: <IconScale className="btn__icon" /> },
    matching: { label: 'Matching', icon: <IconLink className="btn__icon" /> },
  }[question.type];

  return (
    <article className="panel question">
      <header className="question__head">
        <span className="question__num">{number}</span>
        <span className="chip">
          {meta.icon}
          {meta.label}
        </span>
        <span className="spacer" />
        <span className="muted">
          {questionWeight(question)} {questionWeight(question) === 1 ? 'point' : 'points'}
        </span>
      </header>

      {question.type === 'written' && (
        <>
          <p className="question__prompt">{question.prompt}</p>
          <input
            ref={inputRef}
            className="input question__answer"
            placeholder="Your answer"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </>
      )}

      {question.type === 'truefalse' && (
        <>
          <p className="question__prompt">{question.prompt}</p>
          <p className="question__claim">
            <span className="eyebrow">is paired with</span>
            {question.claim}
          </p>
          <div className="row question__tf">
            <button
              className={value === true ? 'btn tf-btn is-picked' : 'btn btn--ghost tf-btn'}
              onClick={() => onChange(true)}
            >
              <IconCheck className="btn__icon" />
              True
            </button>
            <button
              className={value === false ? 'btn tf-btn is-picked' : 'btn btn--ghost tf-btn'}
              onClick={() => onChange(false)}
            >
              <IconX className="btn__icon" />
              False
            </button>
          </div>
        </>
      )}

      {question.type === 'matching' && (
        <MatchingBlock
          question={question}
          value={(value as Record<string, string>) ?? {}}
          onChange={onChange}
        />
      )}
    </article>
  );
}

function MatchingBlock({
  question,
  value,
  onChange,
}: {
  question: Extract<Question, { type: 'matching' }>;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}) {
  const used = new Set(Object.values(value).filter(Boolean));

  return (
    <div className="stack">
      <p className="hint">Match each item on the left to one answer from the bank.</p>

      <ol className="bank">
        {question.choices.map((choice, i) => (
          <li key={choice} className={used.has(choice) ? 'bank__item is-used' : 'bank__item'}>
            <span className="bank__letter">{LETTERS[i] ?? i + 1}</span>
            <span className="bank__text">{choice}</span>
          </li>
        ))}
      </ol>

      <ul className="match-rows">
        {question.pairs.map((pair) => (
          <li className="match-row" key={pair.cardId}>
            <span className="match-row__prompt">{pair.prompt}</span>
            <select
              className="input match-row__select"
              value={value[pair.cardId] ?? ''}
              onChange={(e) => onChange({ ...value, [pair.cardId]: e.target.value })}
              aria-label={`Answer for ${pair.prompt}`}
            >
              <option value="">—</option>
              {question.choices.map((choice, i) => (
                <option key={choice} value={choice}>
                  {LETTERS[i] ?? i + 1} · {choice}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
