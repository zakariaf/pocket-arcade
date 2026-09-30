// packages/shell/src/screens/stats/use-stats-model.ts (fixture): the container computes the banner flag.
import { shouldShowBanner } from '@e07/shell/services/ads/ad-policy.ts';

import type { AdContext, AdPolicyConfig } from '@e07/shell/services/ads/ad-policy.ts';
import type { AdsPort } from '@e07/shell/services/ads/ads-port.ts';

export type StatsModel = {
  readonly isPremium: boolean;
  readonly banner: { readonly renderBanner: AdsPort['renderBanner']; readonly isAllowed: boolean };
};

export function statsModel(ads: AdsPort, config: AdPolicyConfig, context: AdContext): StatsModel {
  return {
    isPremium: context.isPremium,
    banner: { renderBanner: ads.renderBanner, isAllowed: shouldShowBanner(config, context, 'stats') },
  };
}
