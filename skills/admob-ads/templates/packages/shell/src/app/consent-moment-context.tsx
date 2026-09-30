// packages/shell/src/app/consent-moment-context.tsx
// What the consent moment (app/consent-moment.tsx) tells the ad hooks: a banner screen asks for
// its ad moment (useBannerSlot), and every AdContext reads the live consent answer, so a banner
// appears as soon as Google's form allows it. Without the provider (screen tests) both fall back
// to the saved answer and to nothing.
import { createContext, use } from 'react';

export type ConsentMomentValue = {
  /** A banner screen opened (an ad is about to load); call the returned function when it closes. */
  readonly requestAdMoment: () => () => void;
  /** The latest consent answer (null: never asked). */
  readonly canRequestAds: boolean | null;
};

export const ConsentMomentContext = createContext<ConsentMomentValue | null>(null);

/** The consent moment's value, or null outside ShellFeatures (screen and hook tests). */
export function useOptionalConsentMoment(): ConsentMomentValue | null {
  return use(ConsentMomentContext);
}
