// packages/shell/src/services/ads/ad-history.ts
import type { AdHistory, LevelOutcome } from './ad-policy.ts';

export const EMPTY_AD_HISTORY: AdHistory = {
  lastInterstitialAtMs: null,
  levelsCompletedSinceInterstitial: 0,
  didLastInterstitialFollowLoss: false,
};

// Every finished level, before the Result screen appears (saved with the stars).
export function recordLevelEnd(history: AdHistory, outcome: LevelOutcome): AdHistory {
  return outcome === 'win'
    ? { ...history, levelsCompletedSinceInterstitial: history.levelsCompletedSinceInterstitial + 1 }
    : history;
}

// Only when the interstitial was actually shown (the SDK reported it opened).
export function recordInterstitialShown(shown: {
  readonly nowMs: number;
  readonly outcome: LevelOutcome;
}): AdHistory {
  return {
    lastInterstitialAtMs: shown.nowMs,
    levelsCompletedSinceInterstitial: 0,
    didLastInterstitialFollowLoss: shown.outcome === 'lose',
  };
}
