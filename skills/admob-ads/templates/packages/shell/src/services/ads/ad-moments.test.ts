// packages/shell/src/services/ads/ad-moments.test.ts
import { EMPTY_AD_HISTORY } from './ad-history.ts';
import { earnRewardedPerk, showInterstitialIfDue } from './ad-moments.ts';
import { createFakeAds } from './fake-ads.ts';

import type { InterstitialRequest } from './ad-policy.ts';
import type { FakeAdsScript } from './fake-ads.ts';

const REQUEST: InterstitialRequest = {
  config: {
    isAdsEnabled: true,
    minLevelsCompletedBeforeFirst: 3,
    minMsBetweenInterstitials: 180_000,
    minLevelsCompletedBetween: 2,
  },
  context: {
    isPremium: false,
    isOnline: true,
    canRequestAds: true,
    isTutorialDone: true,
    levelsCompletedTotal: 5,
  },
  history: EMPTY_AD_HISTORY,
  trigger: { outcome: 'lose', nowMs: 42 },
};

function setup(overrides: Partial<FakeAdsScript> = {}) {
  const calls: string[] = [];
  const ads = createFakeAds({
    rewardedStatus: 'ready',
    interstitialResult: 'shown',
    rewardResult: 'rewarded',
    calls,
    ...overrides,
  });
  const lifecycle = {
    suspend: () => calls.push('suspend'),
    resume: () => calls.push('resume'),
  };
  return { calls, deps: { ads, lifecycle } };
}

describe('ad moments', () => {
  it('pauses the game around the interstitial and records it', async () => {
    const { calls, deps } = setup();
    const history = await showInterstitialIfDue(deps, REQUEST);
    expect(calls).toStrictEqual(['suspend', 'showInterstitial', 'resume', 'preloadInterstitial']);
    expect(history).toStrictEqual({
      lastInterstitialAtMs: 42,
      levelsCompletedSinceInterstitial: 0,
      didLastInterstitialFollowLoss: true,
    });
  });

  it('keeps the history when the policy says no', async () => {
    const { calls, deps } = setup();
    const premium = { ...REQUEST, context: { ...REQUEST.context, isPremium: true } };
    await expect(showInterstitialIfDue(deps, premium)).resolves.toBe(EMPTY_AD_HISTORY);
    expect(calls).toStrictEqual([]);
  });

  it('grants the perk only when the reward was earned', async () => {
    await expect(earnRewardedPerk(setup().deps)).resolves.toBe(true);
    await expect(earnRewardedPerk(setup({ rewardResult: 'dismissed' }).deps)).resolves.toBe(false);
  });
});
