// packages/shell/src/ui/rating-stars.tsx
import { StyleSheet, View } from 'react-native';

import { COMPONENT_SPECS } from './component-specs.ts';
import { RatingStar } from './rating-star.tsx';

import type { ReactNode } from 'react';

const STAR = COMPONENT_SPECS.star;
const SLOTS = [1, 2, 3] as const;

export type RatingStarsProps = {
  /** Stars earned, 0 to 3: filled ones first, then hollow. */
  readonly count: 0 | 1 | 2 | 3;
  /** 'mini' 13 pt (level tiles, gap 1) or 'rating' 34 pt (rating rows, gap 6). */
  readonly size: 'mini' | 'rating';
  /** Hollow-star edge colour; onPrimary on the current level tile. */
  readonly hollowColor?: string;
  /** Translated label ("2 of 3 stars"): given only where the stars stand alone for VoiceOver. */
  readonly label?: string;
  readonly testID?: string;
};

const styles = StyleSheet.create({
  mini: { flexDirection: 'row', gap: COMPONENT_SPECS.levelTile.miniStarGap },
  rating: { flexDirection: 'row', gap: STAR.ratingGap },
});

/** Three rating stars; filled vs hollow is a shape difference, readable in greyscale. */
export function RatingStars({
  count,
  size,
  hollowColor,
  label,
  testID,
}: RatingStarsProps): ReactNode {
  const side = size === 'mini' ? STAR.mini : STAR.rating;
  return (
    <View
      style={size === 'mini' ? styles.mini : styles.rating}
      {...(label === undefined
        ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' }
        : { accessible: true, accessibilityRole: 'image', accessibilityLabel: label })}
      {...(testID === undefined ? {} : { testID })}
    >
      {SLOTS.map((slot) => (
        <RatingStar
          key={slot}
          isFilled={slot <= count}
          size={side}
          {...(hollowColor === undefined ? {} : { hollowColor })}
        />
      ))}
    </View>
  );
}
