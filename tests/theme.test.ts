import { describe, expect, it } from 'vitest';
import { fromLegacySkin, isDino, isPalette } from '../src/state/theme';

/**
 * The dinosaur and the color used to be one choice. Anyone upgrading has that
 * older value in storage and in their synced file, so it has to keep resolving.
 */
describe('legacy skin migration', () => {
  it('splits each old value into the pair it implied', () => {
    expect(fromLegacySkin('triceratops')).toEqual({ dino: 'triceratops', palette: 'pink' });
    expect(fromLegacySkin('brachiosaurus')).toEqual({ dino: 'brachiosaurus', palette: 'blue' });
    expect(fromLegacySkin('stegosaurus')).toEqual({ dino: 'stegosaurus', palette: 'green' });
  });

  it('ignores anything it does not recognize', () => {
    expect(fromLegacySkin('pterodactyl')).toBeNull();
    expect(fromLegacySkin(undefined)).toBeNull();
    expect(fromLegacySkin(42)).toBeNull();
  });
});

describe('value guards', () => {
  it('accepts only real dinosaurs and palettes', () => {
    expect(isDino('velociraptor')).toBe(true);
    expect(isDino('green')).toBe(false);
    expect(isPalette('purple')).toBe(true);
    expect(isPalette('tyrannosaurus')).toBe(false);
  });
});
