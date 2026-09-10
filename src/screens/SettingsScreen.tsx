import { useEffect, useState } from 'react';
import type { Nav } from '../App';
import { ConfirmDialog, TopBar, Segmented, Toggle } from '../components/ui';
import { Dino } from '../components/Dinos';
import { IconCheck, IconRestart } from '../components/Icons';
import { useToast } from '../components/Toast';
import {
  DINOS,
  PALETTES,
  useDino,
  usePalette,
  useSyncTheme,
  useTheme,
  type ThemePref,
} from '../state/theme';
import { useAccount } from '../state/account';
import { OfflineError } from '../lib/supabase';
import { isSyncing, storageKind, storageLocation } from '../lib/storage';

export default function SettingsScreen({ nav }: { nav: Nav }) {
  const [dino, chooseDino] = useDino();
  const [palette, choosePalette] = usePalette();
  const [mode, setMode] = useTheme();
  const [where, setWhere] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void storageLocation().then(setWhere);
    void isSyncing().then(setSyncing);
  }, []);

  return (
    <section className="screen">
      <TopBar title="Settings" onBack={() => nav.back()} />

      <div className="content">
        <div className="wrap wrap--narrow stack">
          <div className="panel stack">
            <div className="panel__head">
              <span className="panel__title">Dinosaur</span>
            </div>
            <p className="hint">
              Choose your mascot. It wears whichever color you pick below.
            </p>

            {/* Every option wears the color that is currently active, so the
                picker previews exactly what you will get. */}
            <ul className="dino-grid">
              {DINOS.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className={option.value === dino ? 'pick pick--dino is-picked' : 'pick pick--dino'}
                    aria-pressed={option.value === dino}
                    onClick={() => chooseDino(option.value)}
                  >
                    <Dino name={option.value} palette={palette} className="pick__art" />
                    <span className="pick__name">{option.label}</span>
                    {option.value === dino && (
                      <span className="pick__tick">
                        <IconCheck />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel stack">
            <div className="panel__head">
              <span className="panel__title">Color</span>
            </div>
            <p className="hint">Sets the whole app, in both light and dark.</p>

            <ul className="color-grid">
              {PALETTES.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className={option.value === palette ? 'pick pick--color is-picked' : 'pick pick--color'}
                    data-palette={option.value}
                    aria-pressed={option.value === palette}
                    aria-label={option.label}
                    onClick={() => choosePalette(option.value)}
                  >
                    <span className="pick__swatch" />
                    <span className="pick__name">{option.label}</span>
                    {option.value === palette && (
                      <span className="pick__tick">
                        <IconCheck />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel stack">
            <div className="panel__head">
              <span className="panel__title">Appearance</span>
            </div>
            <Segmented<ThemePref>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'auto', label: 'Match device' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>

          <AccountPanel nav={nav} />

          <div className="panel stack">
            <div className="panel__head">
              <span className="panel__title">Storage</span>
            </div>
            <p className="hint">
              {syncing
                ? 'Your decks and these choices sync across your devices through iCloud.'
                : storageKind() === 'desktop'
                  ? 'Your decks are saved on this Mac. To move a deck between devices, export it here or send it from your phone.'
                  : 'Your decks are saved on this device. Sync needs iCloud Drive turned on in Settings.'}
            </p>
            {where && <p className="hint settings__path">{where}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Hidden when the build has no Supabase credentials. */
function AccountPanel({ nav }: { nav: Nav }) {
  const { configured, username, signedIn, state, lastSyncedAt, sync, signOut, deleteAccount } =
    useAccount();
  const [syncTheme, setSyncTheme] = useSyncTheme();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!configured) return null;

  async function syncNow() {
    try {
      await sync();
      toast('Decks synced');
    } catch (err) {
      toast(
        err instanceof OfflineError ? 'You are offline' : 'Could not sync, try again later',
        'bad',
      );
    }
  }

  return (
    <div className="panel stack">
      <div className="panel__head">
        <span className="panel__title">Sync</span>
      </div>

      {signedIn ? (
        <>
          <p className="hint">
            Signed in as <strong>{username}</strong>. Decks sync when the app opens and
            whenever you sync by hand.
          </p>

          <Toggle
            label="Sync theme"
            hint="Take the dinosaur, color and appearance from this account. Leave it off to let this device keep its own look."
            checked={syncTheme}
            onChange={setSyncTheme}
          />

          <button
            className="btn btn--block"
            onClick={() => void syncNow()}
            disabled={state === 'syncing'}
          >
            <IconRestart className="btn__icon" />
            {state === 'syncing' ? 'Syncing' : 'Sync now'}
          </button>

          {lastSyncedAt && (
            <p className="hint">Last synced {new Date(lastSyncedAt).toLocaleTimeString()}.</p>
          )}

          <button className="btn btn--ghost btn--block" onClick={() => void signOut()}>
            Sign out
          </button>

          <button className="btn btn--danger btn--block" onClick={() => setConfirmDelete(true)}>
            Delete account
          </button>
        </>
      ) : (
        <>
          <p className="hint">
            {username
              ? `You are signed out. Sign back in as ${username} to sync again.`
              : 'Keep your decks on every device with a username and a password. Stego works fully offline without one.'}
          </p>
          <button className="btn btn--block" onClick={() => nav.go({ name: 'account' })}>
            Sign in or create an account
          </button>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this account?"
          body="This erases the account and everything stored on the server. The decks on this device are kept."
          confirmLabel="Delete account"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void deleteAccount()
              .then(() => toast('Account deleted'))
              .catch(() => toast('Could not delete the account', 'bad'));
          }}
        />
      )}
    </div>
  );
}
