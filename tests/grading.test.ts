import { describe, expect, it } from 'vitest';
import { acceptableAnswers, gradeTest, gradeWritten, normalize, questionWeight } from '../src/lib/grading';
import type { Test } from '../src/types';

describe('normalize', () => {
  it('ignores case, punctuation, accents and spacing', () => {
    expect(normalize('  T. Rex!!  ')).toBe(normalize('t rex'));
    expect(normalize('Vélociraptor')).toBe('velociraptor');
  });

  it('drops a leading article', () => {
    expect(normalize('The Mesozoic Era')).toBe('mesozoic era');
    expect(normalize('a coprolite')).toBe('coprolite');
  });
});

describe('gradeWritten', () => {
  it('accepts an exact answer', () => {
    expect(gradeWritten('Stegosaurus', 'Stegosaurus')).toEqual({ correct: true, fuzzy: false });
  });

  it('accepts any listed alternative', () => {
    expect(acceptableAnswers('T. rex; Tyrannosaurus')).toEqual(['T. rex', 'Tyrannosaurus']);
    expect(gradeWritten('tyrannosaurus', 'T. rex; Tyrannosaurus').correct).toBe(true);
  });

  it('forgives a small typo in a long answer', () => {
    const grade = gradeWritten('Stegosaurs', 'Stegosaurus');
    expect(grade.correct).toBe(true);
    expect(grade.fuzzy).toBe(true);
  });

  it('does not forgive a typo in a short answer', () => {
    expect(gradeWritten('cat', 'bat').correct).toBe(false);
  });

  it('rejects a blank answer', () => {
    expect(gradeWritten('   ', 'Stegosaurus').correct).toBe(false);
  });

  it('rejects a genuinely different answer', () => {
    expect(gradeWritten('Triceratops', 'Stegosaurus').correct).toBe(false);
  });
});

describe('gradeTest', () => {
  const test: Test = {
    deckId: 'd1',
    deckName: 'Test deck',
    createdAt: 0,
    questions: [
      { id: 'w1', type: 'written', cardIds: ['c1'], prompt: 'Stegosaurus', answer: 'Plated dinosaur' },
      {
        id: 't1',
        type: 'truefalse',
        cardIds: ['c2'],
        prompt: 'T. rex',
        claim: 'Plant eater',
        answer: false,
      },
      {
        id: 'm1',
        type: 'matching',
        cardIds: ['c3', 'c4'],
        pairs: [
          { cardId: 'c3', prompt: 'Triceratops', answer: 'Three horns' },
          { cardId: 'c4', prompt: 'Ankylosaurus', answer: 'Tail club' },
        ],
        choices: ['Tail club', 'Three horns'],
      },
    ],
  };

  it('weights a matching block by its pair count', () => {
    expect(questionWeight(test.questions[0])).toBe(1);
    expect(questionWeight(test.questions[2])).toBe(2);
    expect(gradeTest(test, {}).possible).toBe(4);
  });

  it('scores a perfect run at 100%', () => {
    const result = gradeTest(test, {
      w1: 'plated dinosaur',
      t1: false,
      m1: { c3: 'Three horns', c4: 'Tail club' },
    });
    expect(result.earned).toBe(4);
    expect(result.percent).toBe(100);
    expect(result.graded.every((g) => g.correct)).toBe(true);
  });

  it('gives partial credit inside a matching block', () => {
    const result = gradeTest(test, { m1: { c3: 'Three horns', c4: 'Three horns' } });
    const matching = result.graded.find((g) => g.question.id === 'm1')!;
    expect(matching.score).toBe(0.5);
    expect(matching.correct).toBe(false);
    expect(result.earned).toBe(1);
  });

  it('marks unanswered questions wrong rather than throwing', () => {
    const result = gradeTest(test, {});
    expect(result.earned).toBe(0);
    expect(result.percent).toBe(0);
  });

  it('does not accept a true/false answer of the wrong shape', () => {
    const result = gradeTest(test, { t1: 'false' });
    expect(result.graded.find((g) => g.question.id === 't1')!.correct).toBe(false);
  });
});
