// packages/shell/src/services/ads/ad-policy.ts
// Pure implementation of spec 8.8. No SDK, no clock, no storage: everything is an input.

export type BannerScreen = 'home' | 'levels' | 'stats';
export type LevelOutcome = 'win' | 'lose';

// Per-game numbers from game.config.ts (spec 8.8 "configuration values, not hard-coded").
export type AdPolicyConfig = {
  readonly isAdsEnabled: boolean; // master switch, spec 4.3
  readonly minLevelsCompletedBeforeFirst: number; // 3
  readonly minMsBetweenInterstitials: number; // 180_000
  readonly minLevelsCompletedBetween: number; // 2
};

// Live facts, read at decision time.
export type AdContext = {
  readonly isPremium: boolean;
  readonly isOnline: boolean;
  readonly canRequestAds: boolean; // UMP says consent is handled
  readonly isTutorialDone: boolean;
  readonly levelsCompletedTotal: number; // levels won, all time
};

// Persisted in the save document (ads section), updated by ad-history.ts.
export type AdHistory = {
  readonly lastInterstitialAtMs: number | null;
  readonly levelsCompletedSinceInterstitial: number;
  readonly didLastInterstitialFollowLoss: boolean;
};

export type InterstitialRequest = {
  readonly config: AdPolicyConfig;
  readonly context: AdContext;
  readonly history: AdHistory;
  readonly trigger: { readonly outcome: LevelOutcome; readonly nowMs: number };
};

export const BANNER_SCREENS: readonly BannerScreen[] = ['home', 'levels', 'stats'];

// Common gate for every ad format.
export function canServeAds(config: AdPolicyConfig, context: AdContext): boolean {
  return config.isAdsEnabled && !context.isPremium && context.isOnline && context.canRequestAds;
}

export function shouldShowBanner(
  config: AdPolicyConfig,
  context: AdContext,
  screen: BannerScreen,
): boolean {
  return canServeAds(config, context) && context.isTutorialDone && BANNER_SCREENS.includes(screen);
}

// A clock that went backwards makes the stored time meaningless: ignore it.
function msSinceLast(history: AdHistory, nowMs: number): number | null {
  const last = history.lastInterstitialAtMs;
  return last === null || last > nowMs ? null : nowMs - last;
}

// Called only after the player tapped Next / Replay / Try again on the Result screen.
export function shouldShowInterstitial({
  config,
  context,
  history,
  trigger,
}: InterstitialRequest): boolean {
  if (!canServeAds(config, context) || !context.isTutorialDone) return false;
  if (context.levelsCompletedTotal < config.minLevelsCompletedBeforeFirst) return false;
  if (trigger.outcome === 'lose' && history.didLastInterstitialFollowLoss) return false;
  const elapsed = msSinceLast(history, trigger.nowMs);
  if (elapsed === null) return true;
  return (
    elapsed >= config.minMsBetweenInterstitials &&
    history.levelsCompletedSinceInterstitial >= config.minLevelsCompletedBetween
  );
}
