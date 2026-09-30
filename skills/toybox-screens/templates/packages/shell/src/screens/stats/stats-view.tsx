// packages/shell/src/screens/stats/stats-view.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { AdBannerSlot } from '@e07/shell/ui/ad-banner-slot.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';
import { useBannerBandStyle } from '@e07/shell/ui/use-banner-band-style.ts';

import { StatsEmptyState } from './stats-empty-state.tsx';
import { StatsLocalNote } from './stats-local-note.tsx';
import { StatsPanels } from './stats-panels.tsx';

import type { StatsModel } from './stats-model.ts';
import type { ReactNode } from 'react';

export type StatsViewProps = { readonly model: StatsModel };

/**
 * S10 Statistics (body gap 16): the six panels, Reset statistics (danger), the "stored only on
 * this phone" note and the banner; a new player sees the empty state instead of the panels.
 */
export function StatsView({ model }: StatsViewProps): ReactNode {
  const t = useT();
  const bannerBandStyle = useBannerBandStyle();
  // With its banner the page ends above the pinned band (the home indicator sits under the band);
  // without it (Premium, offline, no consent) the tall body scrolls on under the home indicator.
  const isUnderHomeIndicator = !model.banner.isAllowed;
  return (
    <ScreenFrame
      testID="stats.screen"
      {...(isUnderHomeIndicator ? { edges: UNDER_HOME_INDICATOR_EDGES } : {})}
    >
      <TopBar
        testID="stats.top-bar"
        title={t('common.statistics')}
        backLabel={t('common.back')}
        onBack={model.onBack}
        isReducedMotion={model.isReducedMotion}
      />
      <ScreenBody gap="stats" isUnderHomeIndicator={isUnderHomeIndicator}>
        {model.isEmpty ? (
          <StatsEmptyState onPlay={model.onPlay} isReducedMotion={model.isReducedMotion} />
        ) : (
          <>
            <StatsPanels model={model} />
            <Button
              testID="stats.reset-button"
              label={t('stats.reset-button')}
              onPress={model.onReset}
              kind="danger"
              icon="trash"
              isBlock
              isReducedMotion={model.isReducedMotion}
            />
            <StatsLocalNote />
          </>
        )}
      </ScreenBody>
      <AdBannerSlot
        testID="stats.banner-ad"
        loadedStyle={bannerBandStyle}
        renderBanner={model.banner.renderBanner}
        isAllowed={model.banner.isAllowed}
      />
    </ScreenFrame>
  );
}
