import { registerPlugin } from '@capacitor/core';

/**
 * Bridge to the small Swift plugin in `ios/App/App/StegoCloud.swift`, which is
 * the only way to reach the app's iCloud container — Capacitor's Filesystem
 * plugin can see local storage but not the ubiquity container.
 */
export interface StegoCloudPlugin {
  /** Whether an iCloud container is provisioned and the user is signed in. */
  available(): Promise<{ available: boolean }>;
  read(options: { path: string }): Promise<{ contents: string | null }>;
  write(options: { path: string; contents: string }): Promise<void>;
}

const plugin = registerPlugin<StegoCloudPlugin>('StegoCloud');

let cached: boolean | null = null;

/**
 * True only when the plugin is compiled in, the entitlement is present, and the
 * user is signed into iCloud. Any of those missing means the caller quietly
 * falls back to local storage, so the app still works on a free account.
 */
async function available(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    cached = (await plugin.available()).available === true;
  } catch {
    cached = false;
  }
  return cached;
}

async function read(path: string): Promise<string | null> {
  try {
    return (await plugin.read({ path })).contents ?? null;
  } catch {
    return null;
  }
}

async function write(path: string, contents: string): Promise<void> {
  await plugin.write({ path, contents });
}

/** Forgets the cached probe, e.g. after the user signs into iCloud. */
function reset(): void {
  cached = null;
}

export const cloud = { available, read, write, reset };
