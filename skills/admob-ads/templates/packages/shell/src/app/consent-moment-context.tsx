// packages/shell/src/app/consent-moment-context.tsx
// What the consent moment (app/consent-moment.tsx) tells the ad hooks: a banner screen asks for
// its ad moment (useBannerSlot), and every AdContext reads the live consent answer, so a banner
// appears as soon as Google's form allows it. Without the provider (screen tests) both fall back
// to the saved answer and to nothing. Settings reopens Google's privacy options through it too.
import { createContext, use } from 'react';

export type ConsentMomentValue = {
  /** A banner screen opened (an ad is about to load); call the returned function when it closes. */
  readonly requestAdMoment: () => () => void;
  /** The latest consent answer (null: never asked). */
  readonly canRequestAds: boolean | null;
  /**
   * S11's "Ad privacy choices" row: Google's latest privacy-options answer (launch refresh, form
   * or the options themselves), so the row appears or goes while Settings is open. ConsentMoment
   * always sets it; a hand-made value without it (hook tests) means the saved answer.
   */
  readonly isPrivacyOptionsRequired?: boolean;
};

export const ConsentMomentContext = createContext<ConsentMomentValue | null>(null);

/** The consent moment's value, or null outside ShellFeatures (screen and hook tests). */
export function useOptionalConsentMoment(): ConsentMomentValue | null {
  return use(ConsentMomentContext);
}

/**
 * S11's "Ad privacy choices" row: Google's privacy options through the consent moment, so the
 * answer is saved and a yes after a refusal shows banners again without a relaunch.
 */
export const AdPrivacyChoicesContext = createContext<(() => void) | null>(null);

/** The moment's privacy choices, or null outside ShellFeatures (screen and hook tests). */
export function useOptionalAdPrivacyChoices(): (() => void) | null {
  return use(AdPrivacyChoicesContext);
}
