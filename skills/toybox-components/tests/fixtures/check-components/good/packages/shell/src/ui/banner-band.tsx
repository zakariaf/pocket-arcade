// packages/shell/src/ui/banner-band.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { LAYOUT } from '@e07/shell/theme/tokens.ts';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const SLOT = COMPONENT_SPECS.bannerSlot;

export type BannerBandProps = {
  /** The ad banner view (the ads skill's AdBannerSlot). */
  readonly children: ReactNode;
  /** False until an ad has loaded: the band then takes no space at all. */
  readonly isVisible: boolean;
  readonly testID: string;
};

const useStyles = makeStyles((theme) => {
  const shell = SHELL_COLORS[theme.scheme];
  const styles = StyleSheet.create({
    // Full bleed: cancels the body's 20 pt gutters. Neutral ad colours, dashed rules top and bottom.
    band: {
      marginInline: -LAYOUT.screenGutter,
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

/** The band that frames a loaded banner ad at the bottom of Home, Levels and Statistics. */
export function BannerBand({ children, isVisible, testID }: BannerBandProps): ReactNode {
  const styles = useStyles();
  if (!isVisible) return null;
  return (
    <View style={styles.band} testID={testID}>
      {children}
    </View>
  );
}
