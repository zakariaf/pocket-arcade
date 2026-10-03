// packages/shell/src/services/ads/ad-moments.ts
// The two places a fullscreen ad may appear: after a Result-screen tap, and a rewarded perk.
import { recordInterstitialShown } from './ad-history.ts';
import { shouldShowInterstitial } from './ad-policy.ts';
import { runFullscreenAd } from './fullscreen-ad.ts';

import type { AdHistory, InterstitialRequest } from './ad-policy.ts';
import type { AdsPort } from './ads-port.ts';
import type { GameLifecycle } from './fullscreen-ad.ts';

export type AdMomentDeps = { readonly ads: AdsPort; readonly lifecycle: GameLifecycle };

// After Next / Replay / Try again (never before the player has seen the result, spec S7).
// Returns the new history to save; the caller then navigates on.
export async function showInterstitialIfDue(
  deps: AdMomentDeps,
  request: InterstitialRequest,
): Promise<AdHistory> {
  if (!shouldShowInterstitial(request)) return request.history;
  const result = await runFullscreenAd(deps.lifecycle, deps.ads.showInterstitial);
  deps.ads.preloadInterstitial(); // the next one loads in the background while the player plays
  return result === 'shown' ? recordInterstitialShown(request.trigger) : request.history;
}

// "Watch an ad to get a hint / continue". True only when the reward was earned.
export async function earnRewardedPerk(deps: AdMomentDeps): Promise<boolean> {
  const result = await runFullscreenAd(deps.lifecycle, deps.ads.showRewarded);
  deps.ads.preloadRewarded();
  return result === 'rewarded';
}
