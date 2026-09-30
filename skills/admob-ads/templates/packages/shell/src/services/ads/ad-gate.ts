// packages/shell/src/services/ads/ad-gate.ts
// Orchestrates consent -> initialize -> preload (spec S3: consent before the first ad request).
// Where Google's form is required, the Shell's own consent moment (S3, ConsentIntroScreen) comes
// first: showIntro resolves when the player taps Continue, and only then Google's form opens.
import type { AdsPort } from './ads-port.ts';
import type { ConsentInfo, ConsentPort } from '@e07/shell/services/consent/consent-port.ts';

export type AdGateDeps = {
  readonly ads: AdsPort;
  readonly consent: ConsentPort;
  readonly onConsent: (info: ConsentInfo) => void; // stores canRequestAds + privacy-row flag
};

/** prepareAds also needs the consent moment: it shows S3 and resolves on Continue. */
export type PrepareAdsDeps = AdGateDeps & { readonly showIntro: () => Promise<void> };

export type AdGateInput = {
  readonly isPremium: boolean;
  readonly isAdsEnabled: boolean;
  readonly isTutorialDone: boolean;
  readonly isOnline: boolean;
};

// 1. At every launch: refresh consent info. Never blocks the splash.
export async function refreshConsentAtLaunch(deps: AdGateDeps, input: AdGateInput): Promise<void> {
  if (input.isPremium || !input.isAdsEnabled) return;
  deps.onConsent(await deps.consent.refresh());
}

// S3 where consent is required: the Shell's moment, then Google's form.
async function consentThroughIntro(deps: PrepareAdsDeps): Promise<ConsentInfo> {
  await deps.showIntro();
  const info = await deps.consent.showFormIfRequired();
  deps.onConsent(info);
  return info;
}

// 2. Before the first ad is ever requested (Home after the tutorial, or any later ad moment).
export async function prepareAds(deps: PrepareAdsDeps, input: AdGateInput): Promise<boolean> {
  if (input.isPremium || !input.isAdsEnabled || !input.isTutorialDone || !input.isOnline) {
    return false; // S3: skipped offline/Premium; retried the next time an ad is about to load
  }
  const known = await deps.consent.refresh();
  deps.onConsent(known);
  // Consent given before, or not required in this region: no intro and no form.
  const info = known.canRequestAds ? known : await consentThroughIntro(deps);
  if (!info.canRequestAds) return false;
  await deps.ads.initialize();
  deps.ads.preloadInterstitial();
  deps.ads.preloadRewarded();
  return true;
}
