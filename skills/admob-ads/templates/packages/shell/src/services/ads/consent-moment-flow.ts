// packages/shell/src/services/ads/consent-moment-flow.ts
// When the Shell's consent moment (S3) shows, as plain data for app/consent-moment.tsx. The first
// time an ad is about to load (a banner screen is open: Home, Levels or Statistics) the flow runs
// prepareAds once per session; where Google's form is required, its intro step shows the moment
// over that screen until the player taps Continue, and only then the form, initialize and
// preload run. Apple's tracking prompt (ATT) follows the form, before initialize; like the intro,
// it shows only over a banner screen. Never during the tutorial, offline, for Premium or with ads
// off (the gate), and never over a level: the intro and the ATT prompt wait while no banner screen
// is open. A parity capture of the S3 frame holds the intro and asks neither Google nor Apple.
// The snapshot's canRequestAds turns true only once prepareAds has finished (ATT answered, SDK
// initialised): banner slots read it, so no banner requests an ad while Apple's prompt is up.
// A withdrawn consent always wins: a no given through Ad privacy choices while prepareAds still
// runs stops it before Apple's prompt, initialize and the preloads, and keeps the banners off.
import { prepareAds, refreshConsentAtLaunch } from './ad-gate.ts';

import type { AdGateDeps, AdGateInput, PrepareAdsDeps } from './ad-gate.ts';
import type { AdsPort } from './ads-port.ts';
import type { ConsentInfo, ConsentPort } from '@e07/shell/services/consent/consent-port.ts';

export type ConsentMomentSnapshot = {
  readonly isIntroShown: boolean;
  /**
   * Whether ads may be requested (null: never asked); banners re-render when it changes. It starts
   * as the saved answer, turns false as soon as consent allows no ads, and turns true only after
   * prepareAds finished this session (consent, the ATT answer and initialize, in that order).
   */
  readonly canRequestAds: boolean | null;
};

export type ConsentMomentFlowDeps = AdGateDeps & {
  /** The S3 parity frame: the intro shows at once and stays; nothing is asked of Google. */
  readonly isHeld: boolean;
  /** The saved answer of the last session (save.doc().ads.consent.canRequestAds). */
  readonly savedCanRequestAds: boolean | null;
  /** ErrorLogPort.record('ads', ...): consent failures are logged, never shown. */
  readonly onError: (error: unknown) => void;
};

export type ConsentMomentFlow = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => ConsentMomentSnapshot;
  /** The gate's facts, whenever one changes: a closed gate that opens retries the moment. */
  readonly updateInput: (input: AdGateInput) => void;
  /** A banner screen opened: prepare ads once; call the returned function when it closes. */
  readonly requestAdMoment: () => () => void;
  /** Spec S3: refresh consent info once per launch (skipped while the moment runs anyway). */
  readonly refreshAtLaunch: () => void;
  /** Continue on the intro: Google's form opens next (a held parity frame ignores it). */
  readonly continueToForm: () => void;
  /**
   * S11's Ad privacy choices: Google's privacy options, the answer saved. A yes after a refusal
   * prepares ads again at the next banner screen (Apple's prompt, initialize), and a no closes the
   * banners at once: no relaunch either way.
   */
  readonly reopenPrivacyOptions: () => void;
};

type Phase = 'idle' | 'preparing' | 'done';

/** The flow's one mutable record, changed only by the functions of createConsentMomentFlow. */
type FlowState = {
  phase: Phase;
  openSlots: number;
  isIntroWanted: boolean;
  /** The moment was shown this session: whatever the answer, it is not shown again. */
  wasAsked: boolean;
  release: (() => void) | null;
  /** A tracking request waiting for a banner screen (the player left for a level meanwhile). */
  adScreenWaiters: (() => void)[];
  input: AdGateInput | null;
  canRequestAds: boolean | null;
  /** The latest consent answer of this session allows no ads (read again before every step). */
  isConsentRefused: boolean;
};

type Publisher = Pick<ConsentMomentFlow, 'subscribe' | 'getSnapshot'> & {
  readonly publish: () => void;
};

function createPublisher(deps: ConsentMomentFlowDeps, state: Readonly<FlowState>): Publisher {
  const listeners = new Set<() => void>();
  let snapshot: ConsentMomentSnapshot = {
    isIntroShown: deps.isHeld,
    canRequestAds: deps.savedCanRequestAds,
  };
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    publish: () => {
      const isIntroShown = deps.isHeld || (state.isIntroWanted && state.openSlots > 0);
      const { canRequestAds } = state;
      if (isIntroShown === snapshot.isIntroShown && canRequestAds === snapshot.canRequestAds)
        return;
      snapshot = { isIntroShown, canRequestAds };
      for (const listener of listeners) listener();
    },
  };
}

/** Apple's prompt, like the S3 intro, shows only over a banner screen: never over a level. */
function trackingOverAdScreen(consent: ConsentPort, state: FlowState): ConsentPort {
  return {
    ...consent,
    requestTracking: async () => {
      if (state.openSlots === 0) {
        await new Promise<void>((resolve) => state.adScreenWaiters.push(resolve));
      }
      // A no given while the prompt waited (Ad privacy choices on S11): Apple is not asked.
      return state.isConsentRefused ? 'unavailable' : consent.requestTracking();
    },
  };
}

/** initialize and the preloads only while the latest answer still allows ads. */
function adsWhileConsented(ads: AdsPort, state: FlowState): AdsPort {
  return {
    ...ads,
    initialize: () => (state.isConsentRefused ? Promise.resolve() : ads.initialize()),
    preloadInterstitial: () => {
      if (!state.isConsentRefused) ads.preloadInterstitial();
    },
    preloadRewarded: () => {
      if (!state.isConsentRefused) ads.preloadRewarded();
    },
  };
}

/** prepareAds' dependencies: Apple's prompt only over a banner screen, S3 through the snapshot. */
function createGateDeps(parts: Pick<FlowParts, 'deps' | 'state' | 'publish'>): PrepareAdsDeps {
  const { deps, state, publish } = parts;
  return {
    ads: adsWhileConsented(deps.ads, state),
    consent: trackingOverAdScreen(deps.consent, state),
    onConsent: (info: ConsentInfo) => {
      deps.onConsent(info);
      state.isConsentRefused = !info.canRequestAds;
      // A refusal closes the banners at once; a yes waits for the ATT answer and initialize.
      if (info.canRequestAds) return;
      state.canRequestAds = false;
      publish();
    },
    showIntro: () =>
      new Promise<void>((resolve) => {
        state.isIntroWanted = true;
        state.wasAsked = true;
        state.release = resolve;
        publish();
      }),
  };
}

export function createConsentMomentFlow(deps: ConsentMomentFlowDeps): ConsentMomentFlow {
  const state: FlowState = {
    ...{ phase: 'idle', openSlots: 0, isIntroWanted: false, wasAsked: false },
    ...{ release: null, adScreenWaiters: [], input: null },
    ...{ canRequestAds: deps.savedCanRequestAds, isConsentRefused: false },
  };
  const { publish, ...reads } = createPublisher(deps, state);
  const gate = createGateDeps({ deps, state, publish });
  /** Runs prepareAds while a banner screen is open; a closed gate (offline ...) stays idle. */
  const prepareIfDue = (): void => {
    const { input } = state;
    if (deps.isHeld || state.phase !== 'idle' || state.openSlots === 0 || input === null) return;
    state.phase = 'preparing';
    prepareAds(gate, input).then(
      // Once the player saw the moment (or ads are ready) it never comes back this session.
      (isReady) => {
        // Consent read again: a no given meanwhile wins (a later yes prepares ads again).
        if (isReady && !state.isConsentRefused) {
          state.canRequestAds = true; // O1 / L10: consent, ATT answer and initialize are done
          publish();
        }
        state.phase = isReady || state.wasAsked ? 'done' : 'idle';
        // The facts changed while the gate decided (a first-run link ends the tutorial as Home
        // opens): decide again with the new ones, or the moment would wait for the next screen.
        if (state.phase === 'idle' && state.input !== input) prepareIfDue();
      },
      (error: unknown) => {
        deps.onError(error);
        state.phase = 'idle';
      },
    );
  };
  return createFlowApi({ deps, state, publish, prepareIfDue, gate, reads });
}

type FlowParts = {
  readonly deps: ConsentMomentFlowDeps;
  readonly state: FlowState;
  readonly publish: () => void;
  readonly prepareIfDue: () => void;
  readonly gate: AdGateDeps;
  readonly reads: Pick<ConsentMomentFlow, 'subscribe' | 'getSnapshot'>;
};

function createFlowApi(parts: FlowParts): ConsentMomentFlow {
  const { deps, state, publish, prepareIfDue } = parts;
  return {
    ...parts.reads,
    updateInput: (input) => {
      state.input = input;
      prepareIfDue();
    },
    requestAdMoment: () => {
      state.openSlots += 1;
      for (const resume of state.adScreenWaiters.splice(0)) resume();
      prepareIfDue();
      publish();
      return () => {
        state.openSlots -= 1;
        publish();
      };
    },
    refreshAtLaunch: () => {
      if (deps.isHeld || state.phase !== 'idle' || state.input === null) return;
      refreshConsentAtLaunch(parts.gate, state.input).catch(deps.onError);
    },
    continueToForm: () => {
      if (deps.isHeld) return;
      state.isIntroWanted = false;
      state.release?.();
      state.release = null;
      publish();
    },
    reopenPrivacyOptions: () => {
      parts.gate.consent.showPrivacyOptions().then((info) => {
        parts.gate.onConsent(info);
        if (!info.canRequestAds || state.canRequestAds === true || state.phase !== 'done') return;
        state.phase = 'idle';
        prepareIfDue();
      }, deps.onError);
    },
  };
}
