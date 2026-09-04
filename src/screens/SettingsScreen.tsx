import { useEffect, useState } from 'react';
import type { Nav } from '../App';
import { TopBar, Segmented } from '../components/ui';
import { Dino } from '../components/Dinos';
import { IconCheck } from '../components/Icons';
import {
  DEFAULT_PALETTE,
  DINOS,
  PALETTES,
  useDino,
  usePalette,
  useTheme,
  type ThemePref,
} from '../state/theme';
import { isSyncing, storageLocation } from '../lib/storage';

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
              Choose your mascot. It takes on whichever colour you pick below.
            </p>

            {/* Every option is drawn in the default colour, so the choice here
                is only about the animal. */}
            <ul className="dino-grid">
              {DINOS.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className={option.value === dino ? 'pick pick--dino is-picked' : 'pick pick--dino'}
                    aria-pressed={option.value === dino}
                    onClick={() => chooseDino(option.value)}
                  >
                    <Dino name={option.value} palette={DEFAULT_PALETTE} className="pick__art" />
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
              <span className="panel__title">Colour</span>
            </div>
            <p className="hint">Sets the whole app, in both light and dark.</p>

            <ul className="colour-grid">
              {PALETTES.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className={option.value === palette ? 'pick pick--colour is-picked' : 'pick pick--colour'}
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
                : 'Your decks are saved on this device. Sign in to iCloud to sync them.'}
            </p>
            {where && <p className="hint settings__path">{where}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
