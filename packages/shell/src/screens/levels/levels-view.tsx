// packages/shell/src/screens/levels/levels-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { LAYOUT } from '@e07/shell/theme/tokens.ts';
import { AdBannerSlot } from '@e07/shell/ui/ad-banner-slot.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { Toast } from '@e07/shell/ui/toast.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';
import { useBannerBandStyle } from '@e07/shell/ui/use-banner-band-style.ts';

import { LockedPackPanel } from './locked-pack-panel.tsx';
import { PackSection } from './pack-section.tsx';

import type { LevelsModel, LevelTileModel } from './levels-model.ts';
import type { ReactNode } from 'react';

export type LevelsViewProps = { readonly model: LevelsModel };

const styles = StyleSheet.create({
  area: { flex: 1 },
  // The design's toast: absolute, 352 pt below the top of the scrolling body (.lv-toast top 352).
  toast: { position: 'absolute', top: 352, start: LAYOUT.screenGutter, end: LAYOUT.screenGutter },
  // The banner closes the body's column: pushed to the bottom while the packs fit, one block gap
  // after them otherwise, and full bleed across the body's 20 pt gutters (the design's .body).
  banner: { marginTop: 'auto', marginInline: -LAYOUT.screenGutter },
});

/**
 * S8 Levels: top bar, the scrolling packs (open packs as grids, the next locked pack as a
 * dashed panel), the "finish level n" toast for a tapped locked tile, the banner at the bottom.
 */
export function LevelsView({ model }: LevelsViewProps): ReactNode {
  const t = useT();
  const bannerBandStyle = useBannerBandStyle();
  const handlePressTile = (tile: LevelTileModel): void => {
    if (tile.state.kind === 'locked') model.onTapLockedLevel(tile.level);
    else model.onPlayLevel(tile.level);
  };
  return (
    <ScreenFrame testID="levels.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <TopBar
        testID="levels.top-bar"
        title={t('common.levels')}
        backLabel={t('common.back')}
        onBack={model.onBack}
        isReducedMotion={model.isReducedMotion}
      />
      <View style={styles.area}>
        <ScreenBody testID="levels.grid" isUnderHomeIndicator>
          {model.packs.map((pack) =>
            pack.isLocked ? (
              <LockedPackPanel key={pack.number} pack={pack} />
            ) : (
              <PackSection
                key={pack.number}
                pack={pack}
                focusedLevel={model.focusedLevel}
                isReducedMotion={model.isReducedMotion}
                onPressTile={handlePressTile}
              />
            ),
          )}
          <View style={styles.banner}>
            <AdBannerSlot
              testID="levels.banner-ad"
              loadedStyle={bannerBandStyle}
              renderBanner={model.banner.renderBanner}
              isAllowed={model.banner.isAllowed}
            />
          </View>
        </ScreenBody>
        {model.focusedLevel === null ? null : (
          <View style={styles.toast}>
            <Toast
              testID="levels.locked-toast"
              icon="lock"
              text={t('levels.level-tile.locked-toast', { previousLevel: model.focusedLevel - 1 })}
              isReducedMotion={model.isReducedMotion}
            />
          </View>
        )}
      </View>
    </ScreenFrame>
  );
}
