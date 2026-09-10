import { useState } from 'react';
import type { Nav } from '../App';
import { Segmented, TopBar } from '../components/ui';
import { useToast } from '../components/Toast';
import { useAccount } from '../state/account';
import {
  OfflineError,
  USERNAME_RULE,
  describeUsernameRule,
  isOffline,
  normalizeUsername,
  usernameTaken,
} from '../lib/supabase';

type Mode = 'in' | 'up';

export default function AccountScreen({ nav }: { nav: Nav }) {
  const { signIn, signUp, sync } = useAccount();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('in');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const name = normalizeUsername(username);
  const validName = USERNAME_RULE.test(name);
  const validPassword = password.length >= 8;
  const canSubmit = validName && validPassword && !busy;

  async function submit() {
    if (!canSubmit) return;
    setError(null);

    if (isOffline()) {
      setError('You are offline. Connect to the internet to sign in.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'up') {
        // For a clear message only; the unique index is the real guarantee.
        if (await usernameTaken(name)) {
          setError('That username is taken');
          return;
        }
        await signUp(name, password);
      } else {
        await signIn(name, password);
      }

      // Signing in on a device that already has decks merges the two, so
      // nothing is lost in either direction.
      await sync().catch(() => {});
      toast(mode === 'up' ? 'Account created' : `Signed in as ${name}`);
      nav.back();
    } catch (err) {
      setError(
        err instanceof OfflineError
          ? 'You are offline. Connect to the internet to sign in.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen">
      <TopBar title="Sync account" onBack={() => nav.back()} />

      <div className="content">
        <div className="wrap wrap--narrow stack">
          <Segmented<Mode>
            value={mode}
            onChange={(next) => {
              setMode(next);
              setError(null);
            }}
            options={[
              { value: 'in', label: 'Sign in' },
              { value: 'up', label: 'Create account' },
            ]}
          />

          <div className="panel stack">
            <label className="field">
              <span className="field__label">Username</span>
              <input
                className="input"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="stegofan"
              />
            </label>

            <label className="field">
              <span className="field__label">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit();
                }}
              />
            </label>

            {mode === 'up' && (
              <p className="hint">
                {describeUsernameRule()} Passwords need 8 characters or more.
              </p>
            )}

            {error && <p className="form__error">{error}</p>}

            <button className="btn btn--block" onClick={() => void submit()} disabled={!canSubmit}>
              {busy ? 'Working' : mode === 'up' ? 'Create account' : 'Sign in'}
            </button>
          </div>

          {mode === 'up' && (
            <div className="panel stack">
              <span className="panel__title">Before you sign up</span>
              <p className="hint">
                An account is a username and a password, with no email attached. That
                means a forgotten password cannot be reset and the account is gone.
                Your decks are always kept on this device as well, so you would keep
                those either way.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
