// packages/tooling/src/art/art-outputs.test.ts
import {
  ADAPTIVE_GLYPH,
  ADAPTIVE_SAFE_DIAMETER,
  ANDROID_SPLASH_CIRCLE,
  ANDROID_SPLASH_FIT,
  ART_OUTPUTS,
  ICON_GLYPH,
} from './art-outputs.ts';

const fileNames = (): string[] => ART_OUTPUTS.map((output) => output.file);

describe('ART_OUTPUTS', () => {
  it('keeps the five iOS outputs, each 1024 px, in their order', () => {
    expect(ART_OUTPUTS.slice(0, 5)).toStrictEqual([
      { file: 'icon-light.png', variant: 'light', scheme: 'light', size: 1024 },
      { file: 'icon-dark.png', variant: 'dark', scheme: 'dark', size: 1024 },
      { file: 'icon-tinted.png', variant: 'tinted', scheme: 'dark', size: 1024 },
      { file: 'splash-logo.png', variant: 'splash', scheme: 'light', size: 1024 },
      { file: 'splash-logo-dark.png', variant: 'splash', scheme: 'dark', size: 1024 },
    ]);
  });

  it('adds the Android adaptive icon, its monochrome layer, both Android splash icons and the Play icon', () => {
    expect(ART_OUTPUTS.slice(5)).toStrictEqual([
      { file: 'android-icon-foreground.png', variant: 'adaptive', scheme: 'light', size: 1024 },
      { file: 'android-icon-monochrome.png', variant: 'monochrome', scheme: 'light', size: 1024 },
      { file: 'android-splash-icon.png', variant: 'android-splash', scheme: 'light', size: 1024 },
      {
        file: 'android-splash-icon-dark.png',
        variant: 'android-splash',
        scheme: 'dark',
        size: 1024,
      },
      { file: 'play-icon-512.png', variant: 'light', scheme: 'light', size: 512 },
    ]);
    expect(new Set(fileNames()).size).toBe(ART_OUTPUTS.length);
  });
});

describe('Android geometry', () => {
  it('keeps the adaptive glyph square inside the 66 dp safe circle of the 108 dp canvas', () => {
    expect(ADAPTIVE_SAFE_DIAMETER).toBeCloseTo(66 / 108, 10);
    // The glyph square's corners lie on a circle of diameter side * sqrt(2).
    expect(ADAPTIVE_GLYPH * Math.SQRT2).toBeLessThanOrEqual(ADAPTIVE_SAFE_DIAMETER);
    expect(ADAPTIVE_GLYPH).toBe(0.43);
  });

  it('fits the splash tile with its ring inside the Android 12 icon circle (192 of 288 dp)', () => {
    expect(ANDROID_SPLASH_CIRCLE).toBeCloseTo(2 / 3, 10);
    expect(ANDROID_SPLASH_FIT * Math.SQRT2).toBeLessThanOrEqual(ANDROID_SPLASH_CIRCLE);
    expect(ANDROID_SPLASH_FIT).toBe(0.46);
  });

  it('keeps the iOS glyph at the central 62 %', () => {
    expect(ICON_GLYPH).toBe(0.62);
  });
});
