// packages/shell/src/screens/home/home-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AdBannerSlot } from '@e07/shell/ui/ad-banner-slot.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { RowButton } from '@e07/shell/ui/row-button.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame } from '@e07/shell/ui/screen-frame.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';
import { useBannerBandStyle } from '@e07/shell/ui/use-banner-band-style.ts';

import { HomeDailyCard } from './home-daily-card.tsx';
import { HomeKeys } from './home-keys.tsx';
import { HomeTopBar } from './home-top-bar.tsx';

import type { HomeModel } from './home-model.ts';
import type { ReactNode } from 'react';

export type HomeViewProps = { readonly model: HomeModel };

const styles = StyleSheet.create({
  tagline: { alignSelf: 'flex-start' },
});

/**
 * S4 Home, top to bottom: the top bar (brand lock + settings gear); the tagline sticker (no
 * Endless, or Premium); the hero Play key; the daily panel; the Endless row button; the three
 * keys; the Premium row button (not for owners); the banner pinned under the scrolling body
 * (not for owners).
 */
export function HomeView({ model }: HomeViewProps): ReactNode {
  const t = useT();
  const bannerBandStyle = useBannerBandStyle();
  const { actions, isReducedMotion } = model;
  const isTaglineShown = !model.hasEndless || model.isPremium;
  return (
    <ScreenFrame testID="home.screen">
      <HomeTopBar model={model} onOpenSettings={actions.onOpenSettings} />
      <ScreenBody hasTopOverhang={isTaglineShown}>
        {isTaglineShown ? (
          <View style={styles.tagline}>
            <Sticker testID="home.tagline" text={model.tagline} paper="pop" tiltDeg={-2} />
          </View>
        ) : null}
        <Button
          testID="home.play-button"
          label={t(model.play.isContinue ? 'home.play-button.continue' : 'home.play-button.play', {
            level: model.play.level,
          })}
          onPress={actions.onPlay}
          kind="primary"
          size="hero"
          cap="play"
          isBlock
          isReducedMotion={isReducedMotion}
        />
        <HomeDailyCard
          daily={model.daily}
          onPlayDaily={actions.onPlayDaily}
          isReducedMotion={isReducedMotion}
        />
        {model.hasEndless ? (
          <RowButton
            testID="home.endless-card"
            kind="secondary"
            icon="endless"
            iconPaint="accent"
            label={t('home.endless-card.label', { bestScore: model.bestEndlessScore })}
            description={t('home.endless-card.description')}
            onPress={actions.onPlayEndless}
            isReducedMotion={isReducedMotion}
          />
        ) : null}
        <HomeKeys actions={actions} isReducedMotion={isReducedMotion} />
        {model.isPremium ? null : (
          <RowButton
            testID="home.premium-button"
            kind="pop"
            icon="crown"
            iconPaint="gold"
            label={t('home.premium-button.label')}
            description={t('home.premium-button.hint')}
            onPress={actions.onOpenPremium}
            isReducedMotion={isReducedMotion}
          />
        )}
      </ScreenBody>
      <AdBannerSlot
        testID="home.banner-ad"
        loadedStyle={bannerBandStyle}
        renderBanner={model.banner.renderBanner}
        isAllowed={model.banner.isAllowed && !model.isPremium}
      />
    </ScreenFrame>
  );
}
