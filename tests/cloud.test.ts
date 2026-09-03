import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression cover for the bug that shipped in 1.1: a fresh App Store install
 * probes iCloud before iOS has finished provisioning the container, gets a
 * `false`, and — because the answer was cached forever — never used iCloud again.
 */

const probe = vi.fn();

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    available: probe,
    read: vi.fn(),
    write: vi.fn(),
  }),
}));

async function freshCloud() {
  vi.resetModules();
  return (await import('../src/lib/cloud')).cloud;
}

describe('cloud.available', () => {
  beforeEach(() => {
    probe.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-probes after a negative answer instead of giving up for good', async () => {
    probe.mockResolvedValueOnce({ available: false });
    const cloud = await freshCloud();

    expect(await cloud.available()).toBe(false);
    expect(probe).toHaveBeenCalledTimes(1);

    // The container finishes provisioning a moment later.
    probe.mockResolvedValue({ available: true });
    vi.setSystemTime(new Date('2026-08-19T12:00:05Z'));

    expect(await cloud.available()).toBe(true);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('does not hammer the bridge while a negative answer is still fresh', async () => {
    probe.mockResolvedValue({ available: false });
    const cloud = await freshCloud();

    await cloud.available();
    await cloud.available();
    await cloud.available();

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('keeps a positive answer without probing again', async () => {
    probe.mockResolvedValue({ available: true });
    const cloud = await freshCloud();

    expect(await cloud.available()).toBe(true);
    vi.setSystemTime(new Date('2026-08-19T12:10:00Z'));
    expect(await cloud.available()).toBe(true);

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('treats a throwing bridge as unavailable, and still retries later', async () => {
    probe.mockRejectedValueOnce(new Error('plugin missing'));
    const cloud = await freshCloud();

    expect(await cloud.available()).toBe(false);

    probe.mockResolvedValue({ available: true });
    vi.setSystemTime(new Date('2026-08-19T12:00:05Z'));
    expect(await cloud.available()).toBe(true);
  });
});
