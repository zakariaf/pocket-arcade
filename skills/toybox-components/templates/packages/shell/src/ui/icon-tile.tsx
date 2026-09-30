// packages/shell/src/ui/icon-tile.tsx
import { StyleSheet, View } from 'react-native';

import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { RatingStar } from './rating-star.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { Theme } from '@e07/shell/theme/theme-types.ts';
import type { ReactNode } from 'react';

const TILE = COMPONENT_SPECS.iconTile;

/** pop (default) · accent (Endless, Premium benefits) · gold (Premium) · danger · plain (locked pack). */
export type IconTilePaint = 'pop' | 'accent' | 'gold' | 'danger' | 'plain';

export type IconTileProps = {
  /** An icon, or the two-colour rating star ('rating-star' filled, 'rating-star-hollow'). */
  readonly icon: IconName | 'rating-star' | 'rating-star-hollow';
  readonly paint?: IconTilePaint;
  /** 'row' = 38 pt with a 22 pt icon; 'statHeader' = 34 pt with a 20 pt icon. */
  readonly size?: 'row' | 'statHeader';
  /** Part id, usually `<row or panel>.icon`. */
  readonly testID?: string;
};

type TilePaint = { readonly fill: string; readonly ink: string; readonly edge: string };

function paintOf(theme: Theme, paint: IconTilePaint): TilePaint {
  const { colors } = theme;
  const shell = SHELL_COLORS[theme.scheme];
  switch (paint) {
    case 'pop':
      return { fill: colors.pop, ink: colors.onPop, edge: colors.border };
    case 'accent':
      return { fill: colors.primary, ink: colors.onPrimary, edge: colors.border };
    case 'gold':
      return { fill: shell.gold, ink: shell.toyInk, edge: shell.toyInk };
    case 'danger':
      return { fill: shell.dangerFill, ink: colors.danger, edge: colors.danger };
    case 'plain':
      return { fill: colors.surface, ink: colors.icon, edge: colors.border };
  }
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: TILE.radius,
    borderWidth: TILE.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { width: TILE.size, height: TILE.size },
  statHeader: { width: TILE.sizeInStatHeader, height: TILE.sizeInStatHeader },
});

/** A small square that carries an icon at the start of a row or a panel header. Decorative. */
export function IconTile(props: IconTileProps): ReactNode {
  const { icon, paint = 'pop', size = 'row' } = props;
  const theme = useTheme();
  const colors = paintOf(theme, paint);
  const iconSize = size === 'row' ? TILE.icon : TILE.iconInStatHeader;
  const glyph =
    icon === 'rating-star' || icon === 'rating-star-hollow' ? (
      <RatingStar isFilled={icon === 'rating-star'} size={iconSize} hollowColor={colors.ink} />
    ) : (
      <Icon name={icon} color={colors.ink} size={iconSize} />
    );
  return (
    <View
      style={[
        styles.tile,
        size === 'row' ? styles.row : styles.statHeader,
        { backgroundColor: colors.fill, borderColor: colors.edge },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(props.testID === undefined ? {} : { testID: props.testID })}
    >
      {glyph}
    </View>
  );
}
