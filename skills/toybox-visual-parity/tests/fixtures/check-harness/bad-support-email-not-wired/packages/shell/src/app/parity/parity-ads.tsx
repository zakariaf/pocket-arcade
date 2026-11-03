// packages/shell/src/app/parity/parity-ads.tsx
// Test builds only (reached through test-only.ts). The ads of a parity launch: no SDK call and no
// request. The banner slot gets a plain 320 x 50 stand-in (the gates mask its pixels and check its
// place), the rewarded ad's status is always 'ready' (never 'loading', never 'unavailable') so S7's
// Continue-with-ad offer shows in its ready state as the design draws it, and the banner placements
// and the Result placement are forced open although the test build runs with ADS_MODE off (without
// 'result', perkOffer hides the S7 lose frame's Continue offer).
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import type { ParityPlan } from './parity-plans.ts';
import type { AdPlacement } from '@e07/shell/app/use-ad-context.ts';
import type { AdsPort, BannerSlotProps } from '@e07/shell/services/ads/ads-port.ts';
import type { ReactNode } from 'react';

const BANNER_WIDTH = 320;
const BANNER_HEIGHT = 50;

const styles = StyleSheet.create({
  banner: { width: BANNER_WIDTH, height: BANNER_HEIGHT },
});

/** The banner slot collapses until onLoaded fires; the stand-in reports itself loaded once mounted. */
function ParityBanner({ onLoaded }: BannerSlotProps): ReactNode {
  const { colors } = useTheme();
  useEffect(() => {
    onLoaded();
  }, [onLoaded]);
  return (
    <View
      testID="parity.banner-stand-in"
      style={[styles.banner, { backgroundColor: colors.sunken }]}
    />
  );
}

/**
 * The whole AdsPort, written out: nothing loads, so the rewarded status never changes and its
 * subscription never fires; a full-screen ad is never shown (a capture never taps one).
 */
export function createParityAds(): AdsPort {
  return {
    initialize: () => Promise.resolve(),
    preloadInterstitial: () => undefined,
    preloadRewarded: () => undefined,
    rewardedStatus: () => 'ready',
    subscribeRewardedStatus: () => () => undefined,
    showInterstitial: () => Promise.resolve('unavailable'),
    showRewarded: () => Promise.resolve('unavailable'),
    renderBanner: (props) => <ParityBanner {...props} />,
  };
}

/**
 * Home, Levels and Statistics draw the banner band in every non-Premium frame, and S7's lose frame
 * draws the Continue-with-ad offer (perkOffer reads the 'result' placement: online, consent handled,
 * ads on). A Premium frame forces nothing: owners never see an ad.
 */
export function parityForcedPlacements(plan: Pick<ParityPlan, 'premium'>): readonly AdPlacement[] {
  return plan.premium ? [] : ['home', 'levels', 'stats', 'result'];
}
