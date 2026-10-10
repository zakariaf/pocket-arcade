// packages/shell/src/services/ads/consent-moment-flow.test.ts
import { createFakeConsent } from '@e07/shell/services/consent/fake-consent.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { createConsentMomentFlow } from './consent-moment-flow.ts';
import { createFakeAds } from './fake-ads.ts';

import type { AdGateInput } from './ad-gate.ts';
import type { ConsentMomentFlow } from './consent-moment-flow.ts';
import type { ConsentInfo, ConsentPort } from '@e07/shell/services/consent/consent-port.ts';
import type { FakeConsentScript } from '@e07/shell/services/consent/fake-consent.ts';

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
    rewardedStatus: 'unavailable',
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

  // Spec S3 and owner decision O1 / L10: consent, then Apple's prompt, then ads. Banner slots read
  // canRequestAds from this snapshot, so it turns true only once the ATT answer is in and the SDK
  // is initialised: a banner mounted earlier would request an ad while the prompt is still up.
  it('publishes canRequestAds only after the ATT answer and a finished initialize', async () => {
    const calls: string[] = [];
    const initializing: (() => void)[] = [];
    const fakeAds = createFakeAds({
      rewardedStatus: 'unavailable',
      interstitialResult: 'unavailable',
      rewardResult: 'unavailable',
      calls,
    });
    const ads = {
      ...fakeAds,
      initialize: () =>
        new Promise<void>((resolve) => {
          calls.push('initialize');
          initializing.push(resolve);
        }),
    };
    const consent = createFakeConsent({
      afterRefresh: GRANTED,
      afterForm: GRANTED,
      tracking: 'not-determined',
      calls,
    });
    const flow = createConsentMomentFlow({
      ...{ ads, consent, isHeld: false, savedCanRequestAds: null },
      ...{ onConsent: () => undefined, onError: () => undefined },
    });
    const callsWhenAllowed: string[][] = [];
    flow.subscribe(() => {
      if (flow.getSnapshot().canRequestAds === true) callsWhenAllowed.push([...calls]);
    });
    flow.updateInput(AFTER_TUTORIAL);
    flow.requestAdMoment();
    await flushMicrotasks();
    expect([calls, flow.getSnapshot().canRequestAds]).toStrictEqual([
      ['refresh', 'requestTracking', 'initialize'],
      null,
    ]);
    for (const finish of initializing) finish();
    await flushMicrotasks();
    expect(callsWhenAllowed).toStrictEqual([
      ['refresh', 'requestTracking', 'initialize', 'preloadInterstitial', 'preloadRewarded'],
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
        rewardedStatus: 'unavailable',
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

// Spec S11 (Ad privacy choices reopens Google's consent step) and 8.8: a yes given in Settings
// after a refusal turns the banners on in this session, without a relaunch.
describe('consent moment flow, Ad privacy choices', () => {
  function adPrivacySetup(afterRefresh: ConsentInfo) {
    const calls: string[] = [];
    const saved: ConsentInfo[] = [];
    const script: FakeConsentScript = {
      ...{ afterRefresh, afterForm: DENIED, tracking: 'not-determined', calls },
    };
    const flow = createConsentMomentFlow({
      ads: createFakeAds({
        rewardedStatus: 'unavailable',
        interstitialResult: 'unavailable',
        rewardResult: 'unavailable',
        calls,
      }),
      consent: createFakeConsent(script),
      isHeld: false,
      savedCanRequestAds: null,
      onConsent: (info) => {
        saved.push(info);
      },
      onError: () => undefined,
    });
    return { flow, calls, saved, script };
  }

  /** The launch's moment on Home: the intro, Google's form, then the player leaves Home. */
  async function answerAtLaunch(flow: ConsentMomentFlow): Promise<void> {
    flow.updateInput(AFTER_TUTORIAL);
    const release = flow.requestAdMoment();
    await flushMicrotasks();
    flow.continueToForm();
    await flushMicrotasks();
    release();
  }

  it('saves a yes given after a refusal and turns the banners on back on a banner screen', async () => {
    const { flow, calls, saved, script } = adPrivacySetup(DENIED);
    await answerAtLaunch(flow);
    expect(flow.getSnapshot()).toStrictEqual({ isIntroShown: false, canRequestAds: false });

    // On S11 the player reopens Google's choices and allows ads.
    script.afterRefresh = GRANTED;
    script.afterForm = GRANTED;
    flow.reopenPrivacyOptions();
    await flushMicrotasks();
    expect(saved.at(-1)).toStrictEqual(GRANTED);

    // Back on Home: Apple's prompt and initialize run over the banner screen, then banners show.
    flow.requestAdMoment();
    await flushMicrotasks();
    expect(calls.slice(2)).toStrictEqual([
      'showPrivacyOptions',
      'refresh',
      'requestTracking',
      'initialize',
      'preloadInterstitial',
      'preloadRewarded',
    ]);
    expect(flow.getSnapshot()).toStrictEqual({ isIntroShown: false, canRequestAds: true });
  });

  it('closes the banners at once when the choices withdraw consent', async () => {
    const { flow, saved } = adPrivacySetup(GRANTED);
    await answerAtLaunch(flow);
    expect(flow.getSnapshot().canRequestAds).toBe(true);

    flow.reopenPrivacyOptions();
    await flushMicrotasks();
    expect([saved.at(-1), flow.getSnapshot().canRequestAds]).toStrictEqual([DENIED, false]);
  });
});
