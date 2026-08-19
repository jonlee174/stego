import { useCallback, useState } from 'react';
import Home from './screens/Home';
import DeckListScreen from './screens/DeckListScreen';
import DeckEditorScreen from './screens/DeckEditorScreen';
import StudyScreen from './screens/StudyScreen';
import TestSetupScreen from './screens/TestSetupScreen';
import TestRunScreen from './screens/TestRunScreen';
import TestResultsScreen from './screens/TestResultsScreen';
import { useDecks } from './state/decks';
import type { Test, TestConfig, TestResult } from './types';

export type Route =
  | { name: 'home' }
  | { name: 'decks'; intent?: 'study' | 'test' }
  | { name: 'editor'; deckId?: string }
  | { name: 'study'; deckId: string }
  | { name: 'testSetup'; deckId: string }
  | { name: 'testRun' }
  | { name: 'testResults' };

export interface Nav {
  go(route: Route): void;
  back(): void;
}

export default function App() {
  const { ready } = useDecks();
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [test, setTest] = useState<Test | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [lastConfig, setLastConfig] = useState<TestConfig | null>(null);

  const go = useCallback((route: Route) => {
    setStack((prev) => {
      // Home always resets the stack; nothing should ever be "behind" it.
      if (route.name === 'home') return [{ name: 'home' }];
      return [...prev, route];
    });
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const nav: Nav = { go, back };
  const route = stack[stack.length - 1];

  const startTest = useCallback(
    (generated: Test, config: TestConfig) => {
      setTest(generated);
      setLastConfig(config);
      setResult(null);
      go({ name: 'testRun' });
    },
    [go],
  );

  const finishTest = useCallback(
    (graded: TestResult) => {
      setResult(graded);
      // Replace the runner in the stack so Back from results doesn't re-enter
      // a test that has already been submitted.
      setStack((prev) => [...prev.slice(0, -1), { name: 'testResults' }]);
    },
    [],
  );

  if (!ready) {
    return (
      <div className="app-shell">
        <div className="boot">
          <span className="boot__dot" />
          <span className="boot__dot" />
          <span className="boot__dot" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {route.name === 'home' && <Home nav={nav} />}
      {route.name === 'decks' && <DeckListScreen nav={nav} intent={route.intent} />}
      {route.name === 'editor' && <DeckEditorScreen nav={nav} deckId={route.deckId} />}
      {route.name === 'study' && <StudyScreen nav={nav} deckId={route.deckId} />}
      {route.name === 'testSetup' && (
        <TestSetupScreen nav={nav} deckId={route.deckId} initialConfig={lastConfig} onStart={startTest} />
      )}
      {route.name === 'testRun' && test && (
        <TestRunScreen nav={nav} test={test} onFinish={finishTest} />
      )}
      {route.name === 'testResults' && result && (
        <TestResultsScreen nav={nav} result={result} lastConfig={lastConfig} onRetake={startTest} />
      )}
    </div>
  );
}
