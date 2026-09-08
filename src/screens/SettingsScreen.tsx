import { useEffect, useState } from 'react';
import type { Nav } from '../App';
import { TopBar, Segmented } from '../components/ui';
import { Dino } from '../components/Dinos';
import { IconCheck } from '../components/Icons';
import {
  DINOS,
  PALETTES,
  useDino,
  usePalette,
  useTheme,
  type ThemePref,
} from '../state/theme';
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
