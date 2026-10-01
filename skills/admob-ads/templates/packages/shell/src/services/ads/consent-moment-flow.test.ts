// packages/shell/src/services/ads/consent-moment-flow.test.ts
import { createFakeConsent } from '@e07/shell/services/consent/fake-consent.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { createConsentMomentFlow } from './consent-moment-flow.ts';
import { createFakeAds } from './fake-ads.ts';

import type { AdGateInput } from './ad-gate.ts';
import type { ConsentMomentFlow } from './consent-moment-flow.ts';
import type { ConsentInfo, ConsentPort } from '@e07/shell/services/consent/consent-port.ts';

const GRANTED: ConsentInfo = { canRequestAds: true, isPrivacyOptionsRequired: true };
const DENIED: ConsentInfo = { canRequestAds: false, isPrivacyOptionsRequired: true };
const AFTER_TUTORIAL: AdGateInput = {
  isPremium: false,
  isAdsEnabled: true,
  isTutorialDone: true,
  isOnline: true,
};

type Setup = {
  readonly flow: ConsentMomentFlow;
  readonly calls: string[];
  readonly saved: ConsentInfo[];
  readonly errors: unknown[];
};

/**
 * afterRefresh DENIED: a player in a region where Google's form is required, not yet asked; on
 * iOS with the ATT answer still not-determined.
 */
function setup(
  script: { afterRefresh?: ConsentInfo; afterForm?: ConsentInfo; isHeld?: boolean } = {},
): Setup {
  const calls: string[] = [];
  const saved: ConsentInfo[] = [];
  const errors: unknown[] = [];
  const consent = createFakeConsent({
    afterRefresh: script.afterRefresh ?? DENIED,
    afterForm: script.afterForm ?? GRANTED,
    tracking: 'not-determined',
    calls,
  });
  const ads = createFakeAds({
    isRewardedLoaded: false,
    interstitialResult: 'unavailable',
    rewardResult: 'unavailable',
    calls,
  });
  const flow = createConsentMomentFlow({
    ads,
    consent,
    isHeld: script.isHeld ?? false,
    savedCanRequestAds: null,
    onConsent: (info) => {
      saved.push(info);
    },
    onError: (error) => {
      errors.push(error);
    },
  });
  return { flow, calls, saved, errors };
}

describe('consent moment flow', () => {
  it('shows the moment over a banner screen, then the form, ATT, initialize and preload', async () => {
    const { flow, calls, saved } = setup();
    flow.updateInput(AFTER_TUTORIAL);
    flow.requestAdMoment();
    await flushMicrotasks();
    expect(flow.getSnapshot()).toStrictEqual({ isIntroShown: true, canRequestAds: false });
    expect(calls).toStrictEqual(['refresh']);
    flow.continueToForm();
    await flushMicrotasks();
    expect(flow.getSnapshot()).toStrictEqual({ isIntroShown: false, canRequestAds: true });
    expect(calls).toStrictEqual([
      'refresh',
      'showFormIfRequired',
      'requestTracking',
      'initialize',
      'preloadInterstitial',
      'preloadRewarded',
    ]);
    expect(saved).toStrictEqual([DENIED, GRANTED]);
  });

  it('shows no moment where consent is not required or was already given (ATT still first)', async () => {
    const { flow, calls } = setup({ afterRefresh: GRANTED });
    flow.updateInput(AFTER_TUTORIAL);
    flow.requestAdMoment();
    await flushMicrotasks();
    expect(flow.getSnapshot().isIntroShown).toBe(false);
    expect(calls).toStrictEqual([
      'refresh',
      'requestTracking',
      'initialize',
      'preloadInterstitial',
      'preloadRewarded',
    ]);
  });

  it('waits while no banner screen is open, so the moment never covers a level', async () => {
    const { flow } = setup();
    flow.updateInput(AFTER_TUTORIAL);
    const leaveHome = flow.requestAdMoment();
    leaveHome(); // the player tapped Play before Google answered
    await flushMicrotasks();
    expect(flow.getSnapshot().isIntroShown).toBe(false);
    flow.requestAdMoment(); // back on Home
    expect(flow.getSnapshot().isIntroShown).toBe(true);
  });

  it('asks ATT only over a banner screen: a player who left for a level is asked back on Home', async () => {
    const { flow, calls } = setup({ afterRefresh: GRANTED });
    flow.updateInput(AFTER_TUTORIAL);
    const leaveHome = flow.requestAdMoment();
    leaveHome(); // Play tapped before Google answered: no prompt over the level
    await flushMicrotasks();
    expect(calls).toStrictEqual(['refresh']);
    flow.requestAdMoment(); // back on Home
    await flushMicrotasks();
    expect(calls).toStrictEqual([
      'refresh',
      'requestTracking',
      'initialize',
      'preloadInterstitial',
      'preloadRewarded',
    ]);
  });

  it.each([
    ['during the tutorial', { isTutorialDone: false }],
    ['offline', { isOnline: false }],
    ['for Premium', { isPremium: true }],
    ['with ads off (ADS_MODE=off or the game switch)', { isAdsEnabled: false }],
  ] as const)('asks nothing, ATT included, %s', async (_label, change) => {
    const { flow, calls } = setup();
    flow.updateInput({ ...AFTER_TUTORIAL, ...change });
    flow.requestAdMoment();
    await flushMicrotasks();
    expect([calls, flow.getSnapshot().isIntroShown]).toStrictEqual([[], false]);
  });

  it('decides again when the facts change while the gate decides (tutorial ended as Home opened)', async () => {
    const { flow, calls } = setup();
    flow.updateInput({ ...AFTER_TUTORIAL, isTutorialDone: false });
    flow.requestAdMoment(); // Home's banner slot asks first (child effects run first)
    flow.updateInput(AFTER_TUTORIAL); // then the moment hears that the tutorial is done
    await flushMicrotasks();
    expect(calls).toStrictEqual(['refresh']);
    expect(flow.getSnapshot().isIntroShown).toBe(true);
  });

  it('tries again when the player comes online on a banner screen', async () => {
    const { flow, calls } = setup();
    flow.updateInput({ ...AFTER_TUTORIAL, isOnline: false });
    flow.requestAdMoment();
    await flushMicrotasks();
    flow.updateInput(AFTER_TUTORIAL);
    await flushMicrotasks();
    expect(calls).toStrictEqual(['refresh']);
    expect(flow.getSnapshot().isIntroShown).toBe(true);
  });

  it('asks once per session: an answer that allows no ads is not asked again', async () => {
    const { flow, calls } = setup({ afterForm: DENIED });
    flow.updateInput(AFTER_TUTORIAL);
    const release = flow.requestAdMoment();
    await flushMicrotasks();
    flow.continueToForm();
    await flushMicrotasks();
    release();
    flow.requestAdMoment();
    await flushMicrotasks();
    expect(calls).toStrictEqual(['refresh', 'showFormIfRequired']);
    expect(flow.getSnapshot()).toStrictEqual({ isIntroShown: false, canRequestAds: false });
  });

  it('holds the S3 parity frame: the moment at once, and neither Google nor Apple is asked', async () => {
    const { flow, calls } = setup({ isHeld: true });
    expect(flow.getSnapshot().isIntroShown).toBe(true);
    flow.updateInput(AFTER_TUTORIAL);
    flow.requestAdMoment();
    flow.refreshAtLaunch();
    flow.continueToForm();
    await flushMicrotasks();
    expect([calls, flow.getSnapshot().isIntroShown]).toStrictEqual([[], true]);
  });

  it('refreshes consent once at launch when no moment is running, and logs failures', async () => {
    const { flow, calls, saved } = setup();
    flow.refreshAtLaunch(); // no facts yet: nothing
    flow.updateInput({ ...AFTER_TUTORIAL, isTutorialDone: false });
    flow.refreshAtLaunch();
    await flushMicrotasks();
    expect([calls, saved]).toStrictEqual([['refresh'], [DENIED]]);
    const failing = setup();
    const broken: ConsentPort = {
      ...createFakeConsent({ afterRefresh: DENIED, afterForm: DENIED, calls: [] }),
      refresh: () => Promise.reject(new Error('offline')),
    };
    const flowWithError = createConsentMomentFlow({
      ads: createFakeAds({
        isRewardedLoaded: false,
        interstitialResult: 'unavailable',
        rewardResult: 'unavailable',
        calls: [],
      }),
      consent: broken,
      isHeld: false,
      savedCanRequestAds: true,
      onConsent: () => undefined,
      onError: (error) => {
        failing.errors.push(error);
      },
    });
    flowWithError.updateInput(AFTER_TUTORIAL);
    flowWithError.requestAdMoment();
    await flushMicrotasks();
    expect(failing.errors).toStrictEqual([new Error('offline')]);
    expect(flowWithError.getSnapshot()).toStrictEqual({ isIntroShown: false, canRequestAds: true });
  });

  it('tells its subscribers when the snapshot changes, and stops after unsubscribe', async () => {
    const { flow } = setup();
    const heard = jest.fn();
    const stop = flow.subscribe(heard);
    flow.updateInput(AFTER_TUTORIAL);
    flow.requestAdMoment();
    await flushMicrotasks();
    expect(heard).toHaveBeenCalled();
    stop();
    heard.mockClear();
    flow.continueToForm();
    await flushMicrotasks();
    expect(heard).not.toHaveBeenCalled();
  });
});
