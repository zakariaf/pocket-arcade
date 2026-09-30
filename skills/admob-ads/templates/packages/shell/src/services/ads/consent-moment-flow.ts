// packages/shell/src/services/ads/consent-moment-flow.ts
// When the Shell's consent moment (S3) shows, as plain data for app/consent-moment.tsx. The first
// time an ad is about to load (a banner screen is open: Home, Levels or Statistics) the flow runs
// prepareAds once per session; where Google's form is required, its intro step shows the moment
// over that screen until the player taps Continue, and only then the form, initialize and
// preload run. Never during the tutorial, offline, for Premium or with ads off (the gate), and
// never over a level: the intro waits while no banner screen is open. A parity capture of the S3
// frame holds the intro and never asks Google.
import { prepareAds, refreshConsentAtLaunch } from './ad-gate.ts';

import type { AdGateDeps, AdGateInput, PrepareAdsDeps } from './ad-gate.ts';
import type { ConsentInfo } from '@e07/shell/services/consent/consent-port.ts';

export type ConsentMomentSnapshot = {
  readonly isIntroShown: boolean;
  /** The latest consent answer (null: never asked); banners re-render when it changes. */
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
  input: AdGateInput | null;
  canRequestAds: boolean | null;
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

export function createConsentMomentFlow(deps: ConsentMomentFlowDeps): ConsentMomentFlow {
  const state: FlowState = {
    ...{ phase: 'idle', openSlots: 0, isIntroWanted: false, wasAsked: false },
    ...{ release: null, input: null },
    canRequestAds: deps.savedCanRequestAds,
  };
  const { publish, ...reads } = createPublisher(deps, state);
  const gate: PrepareAdsDeps = {
    ads: deps.ads,
    consent: deps.consent,
    onConsent: (info: ConsentInfo) => {
      deps.onConsent(info);
      state.canRequestAds = info.canRequestAds;
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
  /** Runs prepareAds while a banner screen is open; a closed gate (offline ...) stays idle. */
  const prepareIfDue = (): void => {
    const { input } = state;
    if (deps.isHeld || state.phase !== 'idle' || state.openSlots === 0 || input === null) return;
    state.phase = 'preparing';
    prepareAds(gate, input).then(
      // Once the player saw the moment (or ads are ready) it never comes back this session.
      (isReady) => {
        state.phase = isReady || state.wasAsked ? 'done' : 'idle';
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
  };
}
