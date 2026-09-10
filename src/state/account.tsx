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
  setThemeChangedAt,
  themeChangedAt,
  useSyncTheme,
} from './theme';
import type { AppSettings } from '../types';

/** Cached so the name renders offline. */
const NAME_KEY = 'stego.account.username';
/** Which account the decks on this device belong to. */
const OWNER_KEY = 'stego.library.owner';

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
  /** Resolves true when the library was replaced from a different account.
   * Throws OfflineError when there is no network. */
  sync(): Promise<boolean>;
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
  const { ready, decks, library, replaceLibrary } = useDecks();
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
    if (!configured || !signedIn) return false;
    if (isOffline()) throw new OfflineError();
    if (running.current) return false;

    running.current = true;
    setState('syncing');
    try {
      const { data } = await supabase().auth.getUser();
      const userId = data.user?.id;
      if (!userId) return false;

      const remote = await pull();
      const empty = { decks: [], deleted: [] };
      const owner = (await Preferences.get({ key: OWNER_KEY })).value;
      // Decks on this device belong to whoever last synced them. Merging them
      // into a different account would hand over the library and, worse, carry
      // this account's deletions across as tombstones. An unset owner means
      // they have never synced, so adopting them is the wanted behavior.
      const switched = owner !== null && owner !== userId;

      const next = switched
        ? { decks: remote?.decks ?? [], deleted: remote?.deleted ?? [], changed: true }
        : mergeLibraries(library(), remote ?? empty);

      if (next.changed) replaceLibrary({ decks: next.decks, deleted: next.deleted });
      await Preferences.set({ key: OWNER_KEY, value: userId });

      // Only take the server's appearance when it is newer than the change made
      // here, or a theme picked since the last sync is undone by this pull.
      const remoteAt = remote?.settings?.at ?? 0;
      const localAt = switched ? 0 : themeChangedAt();
      let at = localAt;
      if (syncTheme && remote?.settings && remoteAt > localAt) {
        applyAppearance(remote.settings);
        at = remoteAt;
        setThemeChangedAt(remoteAt);
      }

      await push(
        {
          decks: next.decks,
          deleted: next.deleted,
          settings: syncTheme ? { ...appearance(), at: at || Date.now() } : null,
        },
        userId,
      );
      setLastSyncedAt(Date.now());
      return switched;
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

  // Push edits shortly after they settle. Without this a deck made now only
  // reached the server on the next launch, so switching accounts in between
  // threw it away before it had ever been sent.
  useEffect(() => {
    if (!ready || !signedIn || !syncedOnOpen.current) return;
    const timer = setTimeout(() => void sync().catch(() => {}), 3000);
    return () => clearTimeout(timer);
  }, [decks, ready, signedIn, sync]);

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
        // Last chance to save local work to this account before the session ends.
        if (!isOffline()) await sync().catch(() => {});
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
