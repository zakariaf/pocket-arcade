// packages/shell/src/app/use-consent-moment.ts
// The consent moment's hook (S3): one ConsentMomentFlow per app, fed with the ad gate's live facts,
// the consent refresh once per launch, and what the overlay and the ad hooks need. The gate's
// isAdsEnabled is the build's real ads mode (never a parity capture's forced banner), so a
// screenshot or E2E build (ADS_MODE=off) never asks Google and never shows the moment.
import { useEffect, useState, useSyncExternalStore } from 'react';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { useIsOnline } from '@e07/shell/app/use-is-online.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { createConsentMomentFlow } from '@e07/shell/services/ads/consent-moment-flow.ts';
import { readAdsExtra } from '@e07/shell/services/ads/read-ads-extra.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { selectIsFirstRun } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { ConsentMomentValue } from '@e07/shell/app/consent-moment-context.tsx';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { AdGateInput } from '@e07/shell/services/ads/ad-gate.ts';
import type { ConsentInfo } from '@e07/shell/services/consent/consent-port.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';

export type ConsentMomentModel = {
  readonly value: ConsentMomentValue;
  readonly isIntroShown: boolean;
  /** consent.continue-button: Google's form opens next. */
  readonly onContinue: () => void;
  readonly isReducedMotion: boolean;
};

export type ConsentMomentOptions = {
  /** The S3 parity frame: show the moment at once and hold it (ShellLaunch.isConsentMomentHeld). */
  readonly isHeld: boolean;
  /** Test builds: the debug "Never show ads" switch closes the gate too. */
  readonly debug: DebugServices | null;
};

/** The last consent answer, kept in the save's ads section for the next launch and Settings. */
function saveConsent(save: SaveService, info: ConsentInfo): void {
  const { canRequestAds, isPrivacyOptionsRequired } = info;
  save.update((doc) => ({
    ...doc,
    ads: { ...doc.ads, consent: { canRequestAds, isPrivacyOptionsRequired } },
  }));
}

function useAdGateInput(debug: DebugServices | null): AdGateInput {
  const { adPolicy } = useGameExtra();
  const isAdsMode = readAdsExtra().adsMode !== 'off' && debug?.adsOverride() !== 'never';
  return {
    isPremium: usePremiumStore((state) => state.isPremium),
    isAdsEnabled: adPolicy.isAdsEnabled && isAdsMode,
    isTutorialDone: !useSettingsStore(selectIsFirstRun),
    isOnline: useIsOnline(),
  };
}

export function useConsentMoment(options: ConsentMomentOptions): ConsentMomentModel {
  const { ads, consent, save, errorLog } = useServices();
  const input = useAdGateInput(options.debug);
  const [flow] = useState(() =>
    createConsentMomentFlow({
      ads,
      consent,
      isHeld: options.isHeld,
      savedCanRequestAds: save.doc().ads.consent.canRequestAds,
      onConsent: (info) => {
        saveConsent(save, info);
      },
      onError: (error) => {
        errorLog.record('ads', error);
      },
    }),
  );
  const snapshot = useSyncExternalStore(flow.subscribe, flow.getSnapshot);
  const { isPremium, isAdsEnabled, isTutorialDone, isOnline } = input;
  // Allowed effect: hands the gate's facts to an external flow (online again retries the moment).
  useEffect(() => {
    flow.updateInput({ isPremium, isAdsEnabled, isTutorialDone, isOnline });
  }, [flow, isPremium, isAdsEnabled, isTutorialDone, isOnline]);
  // Allowed effect: one call into an external system after mount (Google's consent refresh).
  useEffect(() => {
    flow.refreshAtLaunch();
  }, [flow]);
  return {
    value: { requestAdMoment: flow.requestAdMoment, canRequestAds: snapshot.canRequestAds },
    isIntroShown: snapshot.isIntroShown,
    onContinue: flow.continueToForm,
    isReducedMotion: useReduceMotion(),
  };
}
