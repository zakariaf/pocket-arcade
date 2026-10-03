// packages/shell/src/ui/use-banner-band-style.ts
import { StyleSheet } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import { COMPONENT_SPECS } from './component-specs.ts';

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
