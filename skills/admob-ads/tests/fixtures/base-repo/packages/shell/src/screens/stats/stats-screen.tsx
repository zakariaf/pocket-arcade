// packages/shell/src/screens/stats/stats-screen.tsx (fixture: the view-model pattern of the screen work)
import { AdBannerSlot } from '@e07/shell/ui/ad-banner-slot.tsx';

import type { StatsModel } from './use-stats-model.ts';
import type { ReactNode } from 'react';

export function StatsView({ model }: { readonly model: StatsModel }): ReactNode {
  return (
    <AdBannerSlot
      testID="stats.banner-ad"
      renderBanner={model.banner.renderBanner}
      isAllowed={model.banner.isAllowed && !model.isPremium}
    />
  );
}
