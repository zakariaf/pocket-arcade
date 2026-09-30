// packages/shell/src/services/ads/ad-gate.test.ts
import { createFakeConsent } from '@e07/shell/services/consent/fake-consent.ts';

import { prepareAds, refreshConsentAtLaunch } from './ad-gate.ts';
import { createFakeAds } from './fake-ads.ts';

import type { AdGateInput } from './ad-gate.ts';
import type { ConsentInfo } from '@e07/shell/services/consent/consent-port.ts';

const GRANTED: ConsentInfo = { canRequestAds: true, isPrivacyOptionsRequired: true };
const DENIED: ConsentInfo = { canRequestAds: false, isPrivacyOptionsRequired: true };
const AFTER_TUTORIAL: AdGateInput = {
  isPremium: false,
  isAdsEnabled: true,
  isTutorialDone: true,
  isOnline: true,
};

/** afterRefresh DENIED: Google's form is required (a player in the EEA who has not answered). */
function setup(afterForm: ConsentInfo, afterRefresh: ConsentInfo = DENIED) {
  const calls: string[] = [];
  const seen: ConsentInfo[] = [];
  const consent = createFakeConsent({ afterRefresh, afterForm, calls });
  const ads = createFakeAds({
    isRewardedLoaded: false,
    interstitialResult: 'unavailable',
    rewardResult: 'unavailable',
    calls,
  });
  const showIntro = (): Promise<void> => {
    calls.push('intro');
    return Promise.resolve();
  };
  const onConsent = (info: ConsentInfo): void => {
    seen.push(info);
  };
  return { calls, seen, deps: { ads, consent, onConsent, showIntro } };
}

describe('ad gate', () => {
  it('shows the consent moment, then the form, then initializes and preloads, in that order', async () => {
    const { calls, seen, deps } = setup(GRANTED);
    await expect(prepareAds(deps, AFTER_TUTORIAL)).resolves.toBe(true);
    expect(calls).toStrictEqual([
      'refresh',
      'intro',
      'showFormIfRequired',
      'initialize',
      'preloadInterstitial',
      'preloadRewarded',
    ]);
    expect(seen).toStrictEqual([DENIED, GRANTED]);
  });

  it('shows no consent moment and no form where consent is not required (or already given)', async () => {
    const { calls, deps } = setup(GRANTED, GRANTED);
    await expect(prepareAds(deps, AFTER_TUTORIAL)).resolves.toBe(true);
    expect(calls).toStrictEqual([
      'refresh',
      'initialize',
      'preloadInterstitial',
      'preloadRewarded',
    ]);
  });

  it('keeps the SDK uninitialized when consent does not allow ad requests', async () => {
    const { calls, deps } = setup(DENIED);
    await expect(prepareAds(deps, AFTER_TUTORIAL)).resolves.toBe(false);
    expect(calls).toStrictEqual(['refresh', 'intro', 'showFormIfRequired']);
  });

  it.each([
    ['during the tutorial', { isTutorialDone: false }],
    ['for Premium', { isPremium: true }],
    ['offline', { isOnline: false }],
    ['with ads off', { isAdsEnabled: false }],
  ] as const)('skips the consent moment and the form %s', async (_label, change) => {
    const { calls, deps } = setup(GRANTED);
    await expect(prepareAds(deps, { ...AFTER_TUTORIAL, ...change })).resolves.toBe(false);
    expect(calls).toStrictEqual([]);
  });

  it('refreshes consent info at launch without showing any form', async () => {
    const { calls, seen, deps } = setup(GRANTED);
    await refreshConsentAtLaunch(deps, { ...AFTER_TUTORIAL, isTutorialDone: false });
    expect(calls).toStrictEqual(['refresh']);
    expect(seen).toStrictEqual([DENIED]);
  });

  it('asks nothing at launch for Premium or with ads off', async () => {
    const { calls, deps } = setup(GRANTED);
    await refreshConsentAtLaunch(deps, { ...AFTER_TUTORIAL, isPremium: true });
    await refreshConsentAtLaunch(deps, { ...AFTER_TUTORIAL, isAdsEnabled: false });
    expect(calls).toStrictEqual([]);
  });
});
