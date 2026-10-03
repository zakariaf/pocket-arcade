// packages/shell/src/services/ads/ad-policy.test.ts
import fc from 'fast-check';

import { EMPTY_AD_HISTORY, recordInterstitialShown, recordLevelEnd } from './ad-history.ts';
import { shouldShowBanner, shouldShowInterstitial } from './ad-policy.ts';

import type { AdContext, AdHistory, AdPolicyConfig, InterstitialRequest } from './ad-policy.ts';

const CONFIG: AdPolicyConfig = {
  isAdsEnabled: true,
  minLevelsCompletedBeforeFirst: 3,
  minMsBetweenInterstitials: 180_000,
  minLevelsCompletedBetween: 2,
};
const READY: AdContext = {
  isPremium: false,
  isOnline: true,
  canRequestAds: true,
  isTutorialDone: true,
  levelsCompletedTotal: 10,
};
const T0 = 1_000_000_000;
const SHOWN_AT_T0 = recordInterstitialShown({ nowMs: T0, outcome: 'win' });
const AFTER_TWO_WINS: AdHistory = recordLevelEnd(recordLevelEnd(SHOWN_AT_T0, 'win'), 'win');

function request(overrides: Partial<InterstitialRequest> = {}): InterstitialRequest {
  return {
    config: CONFIG,
    context: READY,
    history: EMPTY_AD_HISTORY,
    trigger: { outcome: 'win', nowMs: T0 },
    ...overrides,
  };
}

function at(history: AdHistory, outcome: 'win' | 'lose', nowMs: number): InterstitialRequest {
  return request({ history, trigger: { outcome, nowMs } });
}

describe('shouldShowInterstitial', () => {
  it('allows the first interstitial once 3 levels are completed', () => {
    expect(shouldShowInterstitial(request())).toBe(true);
    const early = { ...READY, levelsCompletedTotal: 2 };
    expect(shouldShowInterstitial(request({ context: early }))).toBe(false);
  });

  it.each([
    ['premium', { isPremium: true }],
    ['offline', { isOnline: false }],
    ['consent not handled', { canRequestAds: false }],
    ['tutorial running', { isTutorialDone: false }],
  ] as const)('blocks when %s', (_label, change) => {
    expect(shouldShowInterstitial(request({ context: { ...READY, ...change } }))).toBe(false);
  });

  it('requires 3 minutes AND 2 completed levels since the last one', () => {
    expect(shouldShowInterstitial(at(AFTER_TWO_WINS, 'win', T0 + 179_999))).toBe(false);
    expect(shouldShowInterstitial(at(AFTER_TWO_WINS, 'win', T0 + 180_000))).toBe(true);
    const oneWin = recordLevelEnd(SHOWN_AT_T0, 'win');
    expect(shouldShowInterstitial(at(oneWin, 'win', T0 + 999_999))).toBe(false);
  });

  it('blocks a second interstitial in a row after losses', () => {
    const afterLoss = { ...AFTER_TWO_WINS, didLastInterstitialFollowLoss: true };
    expect(shouldShowInterstitial(at(afterLoss, 'lose', T0 + 999_999))).toBe(false);
    expect(shouldShowInterstitial(at(afterLoss, 'win', T0 + 999_999))).toBe(true);
  });

  // Mutation boundaries (a Stryker run left both alive without them): keep these two.
  it('allows the first interstitial at exactly 3 completed levels', () => {
    const exactly = { ...READY, levelsCompletedTotal: 3 };
    expect(shouldShowInterstitial(request({ context: exactly }))).toBe(true);
  });

  it('blocks an interstitial in the same millisecond as the last one', () => {
    expect(shouldShowInterstitial(at(AFTER_TWO_WINS, 'win', T0))).toBe(false);
  });

  it('ignores a last-shown time in the future (clock moved backwards)', () => {
    expect(shouldShowInterstitial(at(AFTER_TWO_WINS, 'win', T0 - 5))).toBe(true);
  });

  it('hides every ad from a Premium player (property)', () => {
    const facts = fc.record({
      isOnline: fc.boolean(),
      isTutorialDone: fc.boolean(),
      levelsCompletedTotal: fc.nat(),
    });
    fc.assert(
      fc.property(facts, fc.nat(), (fact, nowMs) => {
        const context = { ...READY, ...fact, isPremium: true };
        expect(
          shouldShowInterstitial(request({ context, trigger: { outcome: 'win', nowMs } })),
        ).toBe(false);
        expect(shouldShowBanner(CONFIG, context, 'home')).toBe(false);
      }),
      { seed: 42, numRuns: 200 },
    );
  });
});

describe('shouldShowBanner', () => {
  it('shows banners only on Home, Levels and Statistics', () => {
    expect(shouldShowBanner(CONFIG, READY, 'home')).toBe(true);
    expect(shouldShowBanner(CONFIG, READY, 'stats')).toBe(true);
    expect(shouldShowBanner({ ...CONFIG, isAdsEnabled: false }, READY, 'levels')).toBe(false);
  });
});
