import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Preferences } from '@capacitor/preferences';
import { mergeLibraries } from '../lib/merge';
import {
  OfflineError,
  deleteAccount as deleteRemoteAccount,
  isOffline,
  isSyncConfigured,
  pull,
  push,
  signIn as remoteSignIn,
  signOut as remoteSignOut,
  signUp as remoteSignUp,
  supabase,
} from '../lib/supabase';
import { useDecks } from './decks';
import {
  currentDino,
  currentMode,
  currentPalette,
  isDino,
  isPalette,
  setDino,
  setMode,
  setPalette,
  useSyncTheme,
} from './theme';
import type { AppSettings } from '../types';

/** Cached so the name renders offline. */
const NAME_KEY = 'stego.account.username';

export type SyncState = 'idle' | 'syncing';

interface AccountApi {
  /** False when the app was built without Supabase credentials. */
  configured: boolean;
  /** Readable offline. Null when signed out. */
  username: string | null;
  signedIn: boolean;
  state: SyncState;
  /** When the last successful sync finished, epoch ms. */
  lastSyncedAt: number | null;
  signUp(username: string, password: string): Promise<void>;
  signIn(username: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  /** Throws OfflineError when there is no network. */
  sync(): Promise<void>;
}

const AccountContext = createContext<AccountApi | null>(null);

export function useAccount(): AccountApi {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside <AccountProvider>');
  return ctx;
}

function appearance(): AppSettings {
  return { dino: currentDino(), palette: currentPalette(), mode: currentMode() };
}

function applyAppearance(remote: AppSettings | null) {
  if (!remote) return;
  if (isDino(remote.dino) && remote.dino !== currentDino()) setDino(remote.dino);
  if (isPalette(remote.palette) && remote.palette !== currentPalette()) setPalette(remote.palette);
  if (remote.mode && remote.mode !== currentMode()) setMode(remote.mode);
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const configured = isSyncConfigured();
  const { ready, library, replaceLibrary } = useDecks();
  const [syncTheme] = useSyncTheme();
  const [username, setUsername] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [state, setState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  /** Stops a manual sync landing on top of the one at launch. */
  const running = useRef(false);
  const syncedOnOpen = useRef(false);

  useEffect(() => {
    void Preferences.get({ key: NAME_KEY }).then(({ value }) => {
      if (value) setUsername(value);
    });
  }, []);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;

    void supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setSignedIn(Boolean(data.session));
      });

    const { data } = supabase().auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      const name = session?.user.user_metadata?.username;
      if (typeof name === 'string') {
        setUsername(name);
        void Preferences.set({ key: NAME_KEY, value: name });
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [configured]);

  const sync = useCallback(async () => {
    if (!configured || !signedIn) return;
    if (isOffline()) throw new OfflineError();
    if (running.current) return;

    running.current = true;
    setState('syncing');
    try {
      const { data } = await supabase().auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;

      const remote = await pull();
      const local = library();
      const merged = mergeLibraries(local, remote ?? { decks: [], deleted: [] });

      if (merged.changed) replaceLibrary({ decks: merged.decks, deleted: merged.deleted });

      // Pull before push, so a device joining an account adopts its look.
      if (syncTheme) applyAppearance(remote?.settings ?? null);

      await push(
        {
          decks: merged.decks,
          deleted: merged.deleted,
          settings: syncTheme ? appearance() : null,
        },
        userId,
      );
      setLastSyncedAt(Date.now());
    } finally {
      running.current = false;
      setState('idle');
    }
  }, [configured, signedIn, library, replaceLibrary, syncTheme]);

  // Once per launch. Opening offline is normal, so failures stay quiet.
  useEffect(() => {
    if (!ready || !signedIn || syncedOnOpen.current) return;
    syncedOnOpen.current = true;
    void sync().catch(() => {});
  }, [ready, signedIn, sync]);

  const api = useMemo<AccountApi>(
    () => ({
      configured,
      username,
      signedIn,
      state,
      lastSyncedAt,
      async signUp(name, password) {
        await remoteSignUp(name, password);
        await Preferences.set({ key: NAME_KEY, value: name.toLowerCase() });
        setUsername(name.toLowerCase());
      },
      async signIn(name, password) {
        await remoteSignIn(name, password);
        await Preferences.set({ key: NAME_KEY, value: name.toLowerCase() });
        setUsername(name.toLowerCase());
      },
      async signOut() {
        await remoteSignOut();
        await Preferences.remove({ key: NAME_KEY });
        setUsername(null);
        setLastSyncedAt(null);
        syncedOnOpen.current = false;
      },
      async deleteAccount() {
        await deleteRemoteAccount();
        await Preferences.remove({ key: NAME_KEY });
        setUsername(null);
        setLastSyncedAt(null);
        syncedOnOpen.current = false;
      },
      sync,
    }),
    [configured, username, signedIn, state, lastSyncedAt, sync],
  );

  return <AccountContext.Provider value={api}>{children}</AccountContext.Provider>;
}
