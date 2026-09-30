// packages/shell/src/app/read-game-extra.test.ts
import { readGameExtra } from './read-game-extra.ts';

const GAME = {
  id: 'line-siege',
  premiumProductId: 'com.example.linesiege.premium',
  adPolicy: {
    isAdsEnabled: true,
    minLevelsCompletedBeforeFirst: 3,
    minMsBetweenInterstitials: 180_000,
    minLevelsCompletedBetween: 2,
  },
  modes: { daily: true, endless: false },
  levels: { packCount: 3, levelsPerPack: 20 },
  hints: { freePerDay: 3 },
  isContinueAllowed: true,
  links: {
    privacyPolicy: { host: 'example.com', path: '/privacy' },
    supportEmail: 'support@example.com',
  },
};

describe('readGameExtra', () => {
  it('returns the game config that withShell embedded', () => {
    expect(readGameExtra({ adsMode: 'off', game: GAME })).toStrictEqual(GAME);
  });

  it('keeps the App Store id once the store record exists', () => {
    const game = { ...GAME, appStoreId: '6700000000' };

    expect(readGameExtra({ game })).toStrictEqual(game);
  });

  it('throws when a null reached the app as an empty object', () => {
    expect(() => readGameExtra({ game: { ...GAME, appStoreId: {} } })).toThrow();
  });

  it('throws when the composer left a key out', () => {
    const withoutHints = Object.fromEntries(
      Object.entries(GAME).filter(([key]) => key !== 'hints'),
    );

    expect(() => readGameExtra({ game: withoutHints })).toThrow();
  });

  it('throws when the build has no embedded game config', () => {
    expect(() => readGameExtra(null)).toThrow();
  });
});
