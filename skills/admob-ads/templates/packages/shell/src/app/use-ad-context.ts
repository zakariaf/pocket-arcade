// packages/shell/src/app/use-ad-context.ts
// The live facts every ad decision needs (spec 8.8), read the same way on every screen: Premium
// from its store, online from the ConnectivityPort, the last consent answer from the consent
// moment (app/consent-moment.tsx; the save's answer outside it), the tutorial from the settings
// store and the levels won from the progress store. Screens never build an AdContext by hand; the
// pure policy (ad-policy.ts) decides with it. A banner screen's slot also asks the consent moment
// for its ad moment: the first one after the tutorial is when S3 may appear.
import { createContext, use, useEffect } from 'react';

import { useOptionalConsentMoment } from '@e07/shell/app/consent-moment-context.tsx';
import { useOptionalDebugServices } from '@e07/shell/app/debug-services-context.tsx';
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { useIsOnline } from '@e07/shell/app/use-is-online.ts';
import { shouldShowBanner } from '@e07/shell/services/ads/ad-policy.ts';
import { readAdsExtra } from '@e07/shell/services/ads/read-ads-extra.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { selectFreeHintsLeft, selectLevels } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';
import { selectIsFirstRun } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { DebugAdsOverride } from '@e07/shell/screens/debug/debug-overrides.ts';
import type { AdContext, AdPolicyConfig, BannerScreen } from '@e07/shell/services/ads/ad-policy.ts';
import type { AdsPort } from '@e07/shell/services/ads/ads-port.ts';
import type { HintPerk } from '@e07/shell/services/ads/perk-offer.ts';

/** Where an ad may appear: the three banner slots, and the Result screen's fullscreen moment. */
export type AdPlacement = BannerScreen | 'result';

/** What a banner screen's view draws (AdBannerSlot's two props). */
export type BannerSlotModel = {
  readonly renderBanner: AdsPort['renderBanner'];
  readonly isAllowed: boolean;
};

/**
 * Test builds only: the placements the parity harness (reached through TEST_ONLY) forces open, so a
 * capture shows the banner band although its build runs with ADS_MODE off. It wraps its root in
 * <ForcedAdPlacementsContext value={['home']}>. Nothing provides it in a store build.
 */
export const ForcedAdPlacementsContext = createContext<readonly AdPlacement[]>([]);

/** Every fact of the AdContext for this placement, live (re-renders when one changes). */
export function useAdContext(placement: AdPlacement): AdContext {
  const { save } = useServices();
  const isForced = use(ForcedAdPlacementsContext).includes(placement);
  const isPremium = usePremiumStore((state) => state.isPremium);
  const isOnline = useIsOnline();
  const isTutorialDone = !useSettingsStore(selectIsFirstRun);
  // The levels section is a reference already in the store: count it outside the selector.
  const levelsWon = Object.keys(useProgressStore(selectLevels)).length;
  // The consent moment's live answer; the saved one outside it (null: never asked).
  const moment = useOptionalConsentMoment();
  const canRequestAds =
    (moment === null ? save.doc().ads.consent.canRequestAds : moment.canRequestAds) === true;
  if (isForced)
    return {
      isPremium,
      isOnline: true,
      canRequestAds: true,
      isTutorialDone: true,
      levelsCompletedTotal: levelsWon,
    };
  return { isPremium, isOnline, canRequestAds, isTutorialDone, levelsCompletedTotal: levelsWon };
}

/**
 * Test builds (S15 and the debug link's ads=): "Never show ads" switches ads off, "Always show test
 * ads" drops the pacing rules so a tester sees an ad at every chance. It never turns on an
 * ADS_MODE=off build (no SDK) and never reaches a Premium player (canServeAds still checks).
 */
export function debugAdPolicy(
  config: AdPolicyConfig,
  override: DebugAdsOverride | null,
): AdPolicyConfig {
  if (override === 'never') return { ...config, isAdsEnabled: false };
  if (override === 'always-test') {
    return {
      ...config,
      minLevelsCompletedBeforeFirst: 0,
      minMsBetweenInterstitials: 0,
      minLevelsCompletedBetween: 0,
    };
  }
  return config;
}

/** The game's numbers (game.config.ts), switched off entirely in ADS_MODE=off builds. */
export function useAdPolicyConfig(placement: AdPlacement): AdPolicyConfig {
  const { adPolicy } = useGameExtra();
  const isForced = use(ForcedAdPlacementsContext).includes(placement);
  const isAdsMode = readAdsExtra().adsMode !== 'off' || isForced;
  const override = useOptionalDebugServices()?.adsOverride() ?? null;
  return debugAdPolicy({ ...adPolicy, isAdsEnabled: adPolicy.isAdsEnabled && isAdsMode }, override);
}

/**
 * Home, Levels and Statistics: the banner slot and whether it may show (never for Premium). An
 * open banner screen is an ad moment: the consent moment prepares ads (S3 first where Google's
 * form is required) while one is open.
 */
export function useBannerSlot(placement: BannerScreen): BannerSlotModel {
  const { ads } = useServices();
  const config = useAdPolicyConfig(placement);
  const context = useAdContext(placement);
  const requestAdMoment = useOptionalConsentMoment()?.requestAdMoment;
  // Allowed effect: tells an external flow a banner screen is open; returns its release.
  useEffect(() => requestAdMoment?.(), [requestAdMoment]);
  return {
    renderBanner: ads.renderBanner,
    isAllowed: shouldShowBanner(config, context, placement),
  };
}

/**
 * The hint perk for today (spec 8.5, 8.8): the free hints game.config gives per day
 * (hints.freePerDay; 0 for a game without solver hints, so it never offers a free one) minus
 * those used today. The Game screen passes it to perkOffer for the S5 hint key.
 */
export function useHintPerk(today: DateKey): HintPerk {
  const { hints } = useGameExtra();
  const freeHintsLeft = useProgressStore((state) =>
    selectFreeHintsLeft(state, today, hints.freePerDay),
  );
  return { kind: 'hint', freeHintsLeft };
}
