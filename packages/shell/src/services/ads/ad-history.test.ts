// packages/shell/src/services/ads/ad-history.test.ts
import { EMPTY_AD_HISTORY, recordInterstitialShown, recordLevelEnd } from './ad-history.ts';

describe('ad history', () => {
  it('counts won levels only', () => {
    const afterWin = recordLevelEnd(EMPTY_AD_HISTORY, 'win');
    expect(afterWin.levelsCompletedSinceInterstitial).toBe(1);
    expect(recordLevelEnd(afterWin, 'lose')).toBe(afterWin);
  });

  it('restarts the counters when an interstitial was shown', () => {
    const counted = recordLevelEnd(recordLevelEnd(EMPTY_AD_HISTORY, 'win'), 'win');
    expect(counted.levelsCompletedSinceInterstitial).toBe(2);
    expect(recordInterstitialShown({ nowMs: 5_000, outcome: 'lose' })).toStrictEqual({
      lastInterstitialAtMs: 5_000,
      levelsCompletedSinceInterstitial: 0,
      didLastInterstitialFollowLoss: true,
    });
  });
});
