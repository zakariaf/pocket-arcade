// packages/shell/src/screens/levels/levels-screen.tsx (fixture: the banner model from useBannerSlot, as the model hooks take it)
import { useBannerSlot } from '@e07/shell/app/use-ad-context.ts';
import { AdBannerSlot } from '@e07/shell/ui/ad-banner-slot.tsx';

import type { ReactNode } from 'react';

export function LevelsScreen(): ReactNode {
  const banner = useBannerSlot('levels');
  return (
    <AdBannerSlot
      testID="levels.banner-ad"
      renderBanner={banner.renderBanner}
      isAllowed={banner.isAllowed}
    />
  );
}
