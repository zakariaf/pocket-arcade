// packages/shell/src/ui/premium-art.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { dieCutRing } from './toybox-styles.ts';

import type { ReactNode } from 'react';

const ART = COMPONENT_SPECS.premiumArt;

export type PremiumArtProps = { readonly testID?: string };

const useStyles = makeStyles((theme) => {
  const shell = SHELL_COLORS[theme.scheme];
  const styles = StyleSheet.create({
    art: {
      width: ART.size,
      height: ART.size,
      borderRadius: ART.radius,
      borderWidth: ART.border,
      borderColor: shell.toyInk,
      backgroundColor: shell.gold,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ rotate: `${String(ART.rotate)}deg` }],
      ...dieCutRing(ART.ring, shell.cut),
    },
  });
  return styles;
});

/** The S12 Premium art: a 108 pt gold box with a 64 pt crown, 5 pt ring, tilted -6. Decorative. */
export function PremiumArt({ testID }: PremiumArtProps): ReactNode {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View
      style={styles.art}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(testID === undefined ? {} : { testID })}
    >
      <Icon name="crown" color={SHELL_COLORS[theme.scheme].toyInk} size={ART.icon} />
    </View>
  );
}
