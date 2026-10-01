// packages/shell/src/ui/rating-star.tsx
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';

import type { ReactNode } from 'react';

const MINI = COMPONENT_SPECS.star.mini;

export type RatingStarProps = {
  readonly isFilled: boolean;
  /** 13 (level tiles), 18 (stickers), 22 (inline), 34 (rating rows), 86 / 102 (result). */
  readonly size: number;
  /** Colour of a hollow star's edge; default starOff (onPrimary on the current level tile). */
  readonly hollowColor?: string;
};

const styles = StyleSheet.create({ layer: { position: 'absolute', top: 0, start: 0 } });

/**
 * The two-colour rating star: filled = starOn fill under a border-coloured 1.8 edge (2.2 on 13 pt
 * mini stars); hollow = only the edge. Two stacked icon rasters, so it costs no Skia canvas.
 */
export function RatingStar({ isFilled, size, hollowColor }: RatingStarProps): ReactNode {
  const theme = useTheme();
  const edge = size <= MINI ? 'rating-edge-mini' : 'rating-edge';
  const edgeColor = isFilled ? theme.colors.border : (hollowColor ?? theme.colors.starOff);
  return (
    <View style={{ width: size, height: size }}>
      {isFilled ? (
        <View style={styles.layer}>
          <Icon name="rating-fill" color={theme.colors.starOn} size={size} />
        </View>
      ) : null}
      <View style={styles.layer}>
        <Icon name={edge} color={edgeColor} size={size} />
      </View>
    </View>
  );
}
