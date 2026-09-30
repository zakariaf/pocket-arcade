// packages/shell/src/screens/home/home-screen.tsx (fixture)
import { shouldShowBanner } from '@e07/shell/services/ads/ad-policy.ts';
import { AdBannerSlot } from '@e07/shell/ui/ad-banner-slot.tsx';

import type { AdContext, AdPolicyConfig } from '@e07/shell/services/ads/ad-policy.ts';
import type { AdsPort } from '@e07/shell/services/ads/ads-port.ts';
import type { ReactNode } from 'react';

type Props = { readonly ads: AdsPort; readonly config: AdPolicyConfig; readonly context: AdContext };

export function HomeScreen({ ads, config, context }: Props): ReactNode {
  return (
    <AdBannerSlot
      renderBanner={(callbacks) => ads.renderBanner(callbacks)}
      isAllowed={shouldShowBanner(config, context, 'home')}
      testID="home.banner-ad"
    />
  );
}
