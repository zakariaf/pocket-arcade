// packages/shell/src/ui/use-banner-band-style.ts
import { StyleSheet } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import { COMPONENT_SPECS } from './component-specs.ts';
import { useBodyBottomTopUp } from './use-body-bottom-top-up.ts';

import type { ViewStyle } from 'react-native';

const SLOT = COMPONENT_SPECS.bannerSlot;

const useStyles = makeStyles((theme) => {
  const shell = SHELL_COLORS[theme.scheme];
  const styles = StyleSheet.create({
    // Full bleed by placement: the banner slot is pinned under the scrolling body, outside its
    // 20 pt gutters, so the band spans the window without a negative margin (a -20 margin made it
    // 40 pt too wide and shifted it 20 pt). Neutral ad colours, dashed rules top and bottom.
    band: {
      alignSelf: 'stretch',
      paddingBlock: SLOT.paddingBlock,
      alignItems: 'center',
      backgroundColor: shell.adBackground,
      borderTopWidth: SLOT.borderDashed,
      borderBottomWidth: SLOT.borderDashed,
      borderStyle: 'dashed',
      borderColor: shell.adLine,
    },
  });
  return styles;
});

/**
 * The Toybox banner band (4.17). Screens pass it to AdBannerSlot as loadedStyle, so the band shows
 * only once an ad has loaded: the native banner must stay mounted to load, so it is never wrapped.
 */
export function useBannerBandStyle(): ViewStyle {
  return useStyles().band;
}

/**
 * The band of a banner pinned under the scrolling body, as the page's last block (Home,
 * Statistics): it ends 34 pt above the screen's edge as every Toybox page does, so over Android's
 * 24 dp gesture bar it keeps 10 pt of ground under it (0 above the iPhone's 34 pt home indicator).
 * A banner that closes a body column (Levels) takes useBannerBandStyle: the body already ends there.
 */
export function usePinnedBannerBandStyle(): ViewStyle {
  return { ...useStyles().band, marginBottom: useBodyBottomTopUp() };
}
