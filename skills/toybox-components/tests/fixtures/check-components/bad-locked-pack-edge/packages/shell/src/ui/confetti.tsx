// packages/shell/src/ui/confetti.tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { EASING, MOTION_MS } from '@e07/shell/theme/motion.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { Theme } from '@e07/shell/theme/theme-types.ts';
import type { ReactNode } from 'react';

const PIECE = COMPONENT_SPECS.confetti;
/** The 70 pt band the five pieces are scattered in (S12 success). */
const BAND = 70;
const FALL = 40;
type Paint = 'accent' | 'pop' | 'gold';
/** Where the design scatters the pieces (x, y in pt from the start and top) and how they tilt. */
const PIECES: readonly {
  readonly x: number;
  readonly y: number;
  readonly deg: number;
  readonly paint: Paint;
}[] = [
  { x: 10, y: 18, deg: 18, paint: 'accent' },
  { x: 78, y: 2, deg: -12, paint: 'pop' },
  { x: 150, y: 30, deg: 30, paint: 'gold' },
  { x: 240, y: 8, deg: -24, paint: 'accent' },
  { x: 310, y: 36, deg: 8, paint: 'pop' },
];

export type ConfettiProps = {
  readonly isReducedMotion: boolean;
  /** `premium.confetti`. */
  readonly testID: string;
};

const styles = StyleSheet.create({
  band: { height: BAND, alignSelf: 'stretch' },
  piece: {
    position: 'absolute',
    width: PIECE.size,
    height: PIECE.size,
    borderRadius: PIECE.radius,
    borderWidth: PIECE.border,
  },
});

function paintOf(theme: Theme, paint: Paint): string {
  if (paint === 'accent') return theme.colors.primary;
  if (paint === 'pop') return theme.colors.pop;
  return SHELL_COLORS[theme.scheme].gold;
}

/** Five tilted squares that fall into place with the success sticker; hidden under reduce motion. */
export function Confetti({ isReducedMotion, testID }: ConfettiProps): ReactNode {
  const theme = useTheme();
  const drop = useSharedValue(0);
  useEffect(() => {
    drop.set(
      withTiming(1, { duration: MOTION_MS.stickerSlap, easing: Easing.bezier(...EASING.boing) }),
    );
  }, [drop]);
  const fall = useAnimatedStyle(() => ({
    opacity: drop.get(),
    transform: [{ translateY: interpolate(drop.get(), [0, 1], [-FALL, 0]) }],
  }));
  if (isReducedMotion) return null;
  return (
    <Animated.View
      style={[styles.band, fall]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {PIECES.map((piece) => (
        <View
          key={`${String(piece.x)}-${String(piece.y)}`}
          style={[
            styles.piece,
            {
              start: piece.x,
              top: piece.y,
              backgroundColor: paintOf(theme, piece.paint),
              borderColor: SHELL_COLORS[theme.scheme].toyInk,
              transform: [{ rotate: `${String(piece.deg)}deg` }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}
