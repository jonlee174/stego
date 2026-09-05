/** A single flashcard. `front` is the prompt, `back` is the answer. */
export interface Card {
  id: string;
  front: string;
  back: string;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  cards: Card[];
  createdAt: number;
  updatedAt: number;
}

/** Appearance choices, stored alongside the decks so they sync between devices. */
export interface AppSettings {
  /** Values are kept loose here so types.ts stays free of UI imports. */
  dino?: string;
  palette?: string;
  mode?: 'auto' | 'light' | 'dark';
  /** Written by the version that bundled dinosaur and color into one choice. */
  skin?: string;
}

/** Shape of the on-disk decks.json file. */
export interface DeckFile {
  version: number;
  decks: Deck[];
  settings?: AppSettings;
}

/** Which side of the card a question shows as the prompt. */
export type Direction = 'front-to-back' | 'back-to-front' | 'mixed';

export interface WrittenQuestion {
  id: string;
  type: 'written';
  cardIds: string[];
  prompt: string;
  answer: string;
}

export interface TrueFalseQuestion {
  id: string;
  type: 'truefalse';
  cardIds: string[];
  prompt: string;
  /** The pairing shown to the student, which may be borrowed from another card. */
  claim: string;
  /** True when `claim` really is this card's other side. */
  answer: boolean;
}

interface MatchingPair {
  cardId: string;
  prompt: string;
  answer: string;
}

export interface MatchingQuestion {
  id: string;
  type: 'matching';
  cardIds: string[];
  pairs: MatchingPair[];
  /** Answer choices in scrambled display order. */
  choices: string[];
}

export type Question = WrittenQuestion | TrueFalseQuestion | MatchingQuestion;

export interface TestConfig {
  deckId: string;
  /** How many cards of the deck to pull from, 1..deck.cards.length. */
  cardCount: number;
  written: number;
  truefalse: number;
  matching: number;
  /** Cards bundled into each matching block. */
  matchingGroupSize: number;
  direction: Direction;
}

export interface Test {
  deckId: string;
  deckName: string;
  createdAt: number;
  questions: Question[];
}

/** A student's answer, keyed by question id. */
export type ResponseMap = Record<string, string | boolean | Record<string, string>>;

export interface GradedQuestion {
  question: Question;
  /** 0..1, since matching questions can be partially right. */
  score: number;
  correct: boolean;
  given: string | boolean | Record<string, string> | undefined;
}

export interface TestResult {
  test: Test;
  graded: GradedQuestion[];
  earned: number;
  possible: number;
  percent: number;
}
