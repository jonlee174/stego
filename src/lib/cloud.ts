import { registerPlugin } from '@capacitor/core';

// Bridge to StegoCloud.swift. Capacitor's Filesystem cannot see the ubiquity
// container, so reaching iCloud needs the native plugin.
interface StegoCloudPlugin {
  /** Whether an iCloud container is provisioned and the user is signed in. */
  available(): Promise<{ available: boolean }>;
  read(options: { path: string }): Promise<{ contents: string | null }>;
  write(options: { path: string; contents: string }): Promise<void>;
  /** Reads a security scoped file handed to the app from elsewhere. */
  readIncoming(options: { url: string }): Promise<{ contents: string | null }>;
}

const plugin = registerPlugin<StegoCloudPlugin>('StegoCloud');

let cached: boolean | null = null;
let lastProbe = 0;
/** How long a negative probe is trusted before asking again. */
const RETRY_AFTER_MS = 4000;

/** Needs the plugin, the entitlement and a signed-in user. Falls back to local. */
async function available(): Promise<boolean> {
  // Only cache a yes. iOS returns nil while still provisioning, and caching
  // that no stranded fresh installs on local storage forever.
  if (cached === true) return true;

  const now = Date.now();
  if (cached === false && now - lastProbe < RETRY_AFTER_MS) return false;
  lastProbe = now;

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

/** Reads a file another app handed us, claiming security scoped access first. */
async function readIncoming(url: string): Promise<string | null> {
  try {
    return (await plugin.readIncoming({ url })).contents ?? null;
  } catch {
    return null;
  }
}

export const cloud = { available, read, write, reset, readIncoming };
