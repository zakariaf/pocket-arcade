// packages/shell/src/config/art-config.test.ts
import { ICON_CONFIG, SPLASH_IMAGE_WIDTH, withArt, withGameArt } from './art-config.ts';

import type { ExpoConfig } from 'expo/config';

// splash-grounds.ts ships empty; render-art.ts adds each game once it has drawn it.
jest.mock('./splash-grounds.ts', () => ({
  SPLASH_GROUNDS: { 'line-siege': { light: '#A5DAF3', dark: '#1B1943' } },
}));

const BASE: ExpoConfig = {
  name: 'Line Siege',
  slug: 'line-siege',
  ios: { bundleIdentifier: 'com.example.linesiege' },
  plugins: [['expo-font', { fonts: ['./assets/fonts/LilitaOne.ttf'] }]],
};
const GROUND = { light: '#A5DAF3', dark: '#1B1943' };

describe('withArt', () => {
  it('points the root and iOS icons at the three generated PNGs', () => {
    const config = withArt(BASE, GROUND);

    expect(config.icon).toBe('./assets/generated/icon-light.png');
    expect(config.ios).toStrictEqual({
      bundleIdentifier: 'com.example.linesiege',
      icon: ICON_CONFIG.iosIcon,
    });
  });

  it('appends the splash plugin with the light and dark grounds to the existing plugins', () => {
    const config = withArt(BASE, GROUND);

    expect(config.plugins).toStrictEqual([
      ['expo-font', { fonts: ['./assets/fonts/LilitaOne.ttf'] }],
      [
        'expo-splash-screen',
        {
          image: './assets/generated/splash-logo.png',
          imageWidth: SPLASH_IMAGE_WIDTH,
          backgroundColor: '#A5DAF3',
          dark: { image: './assets/generated/splash-logo-dark.png', backgroundColor: '#1B1943' },
        },
      ],
    ]);
  });
});

describe('withGameArt', () => {
  it('adds the art with the grounds render-art.ts recorded for a drawn game', () => {
    expect(withGameArt(BASE, 'line-siege')).toStrictEqual(withArt(BASE, GROUND));
  });

  it('leaves a game that has no generated art yet unchanged', () => {
    expect(withGameArt(BASE, 'not-drawn-yet')).toBe(BASE);
  });
});
