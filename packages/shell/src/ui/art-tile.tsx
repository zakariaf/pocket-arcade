// packages/shell/src/ui/art-tile.tsx
import { StyleSheet, View } from 'react-native';

import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { dieCutRing } from './toybox-styles.ts';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';

const ART = COMPONENT_SPECS.art;
/** The reset dialog uses a 56 pt tile, the S11c summary a 52 pt one. */
const SIZE = { regular: ART.size, dialog: 56, summary: 52 } as const;

export type ArtTileProps = {
  readonly icon: IconName;
  /** pop (default), gold, or danger (the reset dialog: dangerFill with a danger icon). */
  readonly paint?: 'pop' | 'gold' | 'danger';
  readonly size?: keyof typeof SIZE;
  readonly testID?: string;
};

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ART.radius,
    borderWidth: ART.border,
    transform: [{ rotate: `${String(ART.rotate)}deg` }],
  },
});

/** A 64 pt "boxed toy": printed toy-ink edge, white ring, tilted -5. Leads S2, S3 and dialogs. */
export function ArtTile({
  icon,
  paint = 'pop',
  size = 'regular',
  testID,
}: ArtTileProps): ReactNode {
  const theme = useTheme();
  const shell = SHELL_COLORS[theme.scheme];
  const fills = { pop: theme.colors.pop, gold: shell.gold, danger: shell.dangerFill };
  const side = SIZE[size];
  return (
    <View
      style={[
        styles.tile,
        { width: side, height: side, backgroundColor: fills[paint], borderColor: shell.toyInk },
        dieCutRing(ART.ring, shell.cut),
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(testID === undefined ? {} : { testID })}
    >
      <Icon
        name={icon}
        color={paint === 'danger' ? theme.colors.danger : shell.toyInk}
        size={ART.icon}
      />
    </View>
  );
}
