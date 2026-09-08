import { registerPlugin } from '@capacitor/core';

/**
 * Bridge to the small Swift plugin in `ios/App/App/StegoCloud.swift`, which is
 * the only way to reach the app's iCloud container, since Capacitor's Filesystem
 * plugin can see local storage but not the ubiquity container.
 */
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

/**
 * True only when the plugin is compiled in, the entitlement is present, and the
 * user is signed into iCloud. Any of those missing means the caller quietly
 * falls back to local storage, so the app still works on a free account.
 */
async function available(): Promise<boolean> {
  // A positive answer is stable, so keep it. A negative one is not: iOS returns
  // nil from url(forUbiquityContainerIdentifier:) while it is still provisioning
  // the container, so the very first probe after a fresh install fails even
  // though iCloud is fine moments later. Caching that "false" forever was
  // stranding new installs on local storage permanently.
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
