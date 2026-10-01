// packages/shell/src/services/ads/fake-ads.test.ts
import { createFakeAds } from './fake-ads.ts';

describe('createFakeAds', () => {
  it('answers the scripted rewarded status and tells subscribers when a test moves it', () => {
    const ads = createFakeAds({
      rewardedStatus: 'loading',
      interstitialResult: 'unavailable',
      rewardResult: 'rewarded',
      calls: [],
    });
    const heard: string[] = [];
    const stop = ads.subscribeRewardedStatus(() => heard.push(ads.rewardedStatus()));
    expect(ads.rewardedStatus()).toBe('loading');
    ads.setRewardedStatus('ready');
    stop();
    ads.setRewardedStatus('unavailable');
    expect(heard).toStrictEqual(['ready']);
    expect(ads.rewardedStatus()).toBe('unavailable');
  });

  it('records the calls it gets and resolves the scripted results', async () => {
    const calls: string[] = [];
    const ads = createFakeAds({
      rewardedStatus: 'ready',
      interstitialResult: 'shown',
      rewardResult: 'dismissed',
      calls,
    });
    await ads.initialize();
    ads.preloadInterstitial();
    ads.preloadRewarded();
    await expect(ads.showInterstitial()).resolves.toBe('shown');
    await expect(ads.showRewarded()).resolves.toBe('dismissed');
    expect(ads.renderBanner({ onLoaded: jest.fn(), onFailed: jest.fn() })).toBeNull();
    expect(calls).toStrictEqual([
      'initialize',
      'preloadInterstitial',
      'preloadRewarded',
      'showInterstitial',
      'showRewarded',
    ]);
  });
});
