import { Preferences } from '@capacitor/preferences';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppSettings, Deck, Tombstone } from '../types';

// The anon key is public by design. Row Level Security is what protects the
// data, so never put the service role key here.

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Accounts are named, not emailed, so signup needs a stand-in address. */
const EMAIL_DOMAIN = 'stego.invalid';

export function isSyncConfigured(): boolean {
  return Boolean(URL && ANON_KEY);
}

/** Keychain on iOS, localStorage elsewhere. Holds the refresh token, which is
 * what makes signing in a once-per-device job. */
const preferenceStore = {
  async getItem(key: string) {
    return (await Preferences.get({ key })).value;
  },
  async setItem(key: string, value: string) {
    await Preferences.set({ key, value });
  },
  async removeItem(key: string) {
    await Preferences.remove({ key });
  },
};

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    if (!isSyncConfigured()) throw new Error('Sync is not configured');
    client = createClient(URL!, ANON_KEY!, {
      auth: {
        storage: preferenceStore,
        persistSession: true,
        autoRefreshToken: true,
        // No email flow and no OAuth redirect, so nothing arrives via URL.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;

/** Normalizes to the single stored form, so names are case insensitive. */
export function normalizeUsername(name: string): string {
  return name.trim().toLowerCase();
}

export function describeUsernameRule(): string {
  return '3 to 20 characters, using letters, numbers or underscores.';
}

function addressFor(username: string): string {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`;
}

export interface RemoteLibrary {
  decks: Deck[];
  deleted: Tombstone[];
  settings: AppSettings | null;
}

export class OfflineError extends Error {
  constructor() {
    super('Offline');
    this.name = 'OfflineError';
  }
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Collapses the network failures under a request into one known error. */
function asOffline(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (/fetch|network|Failed to fetch|timeout/i.test(message)) throw new OfflineError();
  throw err instanceof Error ? err : new Error(message);
}

export async function usernameTaken(username: string): Promise<boolean> {
  const { data, error } = await supabase().rpc('username_available', {
    name: normalizeUsername(username),
  });
  if (error) asOffline(error);
  return data === false;
}

export async function signUp(username: string, password: string): Promise<void> {
  // A trigger reads the username from the metadata and creates the profile in
  // the same transaction, so a taken name rolls the whole signup back.
  const { data, error } = await supabase().auth.signUp({
    email: addressFor(username),
    password,
    options: { data: { username: normalizeUsername(username) } },
  });
  if (error) {
    if (/already registered|duplicate|unique/i.test(error.message)) {
      throw new Error('That username is taken');
    }
    asOffline(error);
  }
  // No session means the project wants email confirmation, which a
  // stego.invalid address can never satisfy.
  if (!data.session) {
    throw new Error(
      'This account cannot be finished. Turn off email confirmation in the Supabase project.',
    );
  }
}

export async function signIn(username: string, password: string): Promise<void> {
  const { error } = await supabase().auth.signInWithPassword({
    email: addressFor(username),
    password,
  });
  if (error) {
    if (/invalid login/i.test(error.message)) {
      throw new Error('That username and password do not match');
    }
    asOffline(error);
  }
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase().rpc('delete_account');
  if (error) asOffline(error);
  await signOut();
}

export async function pull(): Promise<RemoteLibrary | null> {
  const { data, error } = await supabase()
    .from('profiles')
    .select('decks, settings')
    .single();
  if (error) asOffline(error);
  if (!data) return null;

  const file = (data.decks ?? {}) as { decks?: Deck[]; deleted?: Tombstone[] };
  return {
    decks: Array.isArray(file.decks) ? file.decks : [],
    deleted: Array.isArray(file.deleted) ? file.deleted : [],
    settings: (data.settings as AppSettings | null) ?? null,
  };
}

export async function push(library: RemoteLibrary, userId: string): Promise<void> {
  const row: Record<string, unknown> = {
    id: userId,
    decks: { version: 1, decks: library.decks, deleted: library.deleted },
    updated_at: new Date().toISOString(),
  };
  // Withheld unless this device has theme sync on.
  if (library.settings) row.settings = library.settings;

  const { error } = await supabase().from('profiles').update(row).eq('id', userId);
  if (error) asOffline(error);
}
