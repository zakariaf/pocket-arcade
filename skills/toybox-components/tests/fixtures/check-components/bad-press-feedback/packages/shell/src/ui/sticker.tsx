// packages/shell/src/ui/sticker.tsx
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { EASING, KEYFRAMES, MOTION_MS } from '@e07/shell/theme/motion.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { RatingStar } from './rating-star.tsx';
import { dieCutRing } from './toybox-styles.ts';

import type { IconName } from './icons/icon-paths.ts';
import type { Theme } from '@e07/shell/theme/theme-types.ts';
import type { ReactNode } from 'react';

const STK = COMPONENT_SPECS.sticker;

/** gold (news: streak, New best, Premium) · accent (the win title) · pop (tagline) · ink (Locked, Test build). */
export type StickerPaper = 'gold' | 'accent' | 'pop' | 'ink';
export type StickerSize = 'regular' | 'sm' | 'xs';

export type StickerProps = {
  readonly text: string;
  readonly testID: string;
  readonly paper?: StickerPaper;
  readonly size?: StickerSize;
  /** Tilt in degrees, 2 to 8 either way (default -4). Never mirrored in RTL. */
  readonly tiltDeg?: number;
  /** An icon, or 'rating-star' for the filled two-colour star (New best). */
  readonly icon?: IconName | 'rating-star';
  /** Slap in on mount (win title 700 ms, New best 950 ms, Premium active 0). */
  readonly slapDelayMs?: number;
  readonly isReducedMotion?: boolean;
};

const styles = StyleSheet.create({
  sticker: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: STK.radius,
    borderWidth: STK.border,
  },
  regular: {
    paddingBlock: STK.paddingBlock,
    paddingStart: STK.paddingStart,
    paddingEnd: STK.paddingEnd,
    gap: STK.gap,
  },
  sm: {
    paddingBlock: STK.sm.paddingBlock,
    paddingStart: STK.sm.paddingStart,
    paddingEnd: STK.sm.paddingEnd,
    gap: STK.gap,
  },
  xs: {
    paddingBlock: STK.xs.paddingBlock,
    paddingStart: STK.xs.paddingStart,
    paddingEnd: STK.xs.paddingEnd,
    gap: STK.xs.gap,
  },
});

const SIZE_STYLE = { regular: styles.regular, sm: styles.sm, xs: styles.xs } as const;
const TEXT_STYLE = { regular: 'sticker', sm: 'stickerSm', xs: 'stickerXs' } as const;

function paperColor(theme: Theme, paper: StickerPaper): string {
  const shell = SHELL_COLORS[theme.scheme];
  switch (paper) {
    case 'gold':
      return shell.gold;
    case 'accent':
      return theme.colors.primary;
    case 'pop':
      return theme.colors.pop;
    case 'ink':
      return shell.toyInk;
  }
}

function useSlap(tiltDeg: number, props: StickerProps): ReturnType<typeof useAnimatedStyle> {
  const isSlapped = props.slapDelayMs !== undefined;
  const isReduced = props.isReducedMotion === true;
  const progress = useSharedValue(isSlapped ? 0 : 1);
  useEffect(() => {
    if (!isSlapped) return;
    const timing = isReduced
      ? { duration: MOTION_MS.reducedFade }
      : { duration: MOTION_MS.stickerSlap, easing: Easing.bezier(...EASING.boing) };
    progress.set(withDelay(props.slapDelayMs ?? 0, withTiming(1, timing)));
  }, [isSlapped, isReduced, progress, props.slapDelayMs]);
  const { fromScale, fromExtraRotateDeg } = KEYFRAMES.stickerSlap;
  return useAnimatedStyle(() => {
    const t = progress.get();
    const scale = isReduced ? 1 : interpolate(t, [0, 1], [fromScale, 1]);
    const rotate = isReduced
      ? tiltDeg
      : interpolate(t, [0, 1], [tiltDeg + fromExtraRotateDeg, tiltDeg]);
    return {
      opacity: Math.min(1, t * 2),
      transform: [{ rotate: `${String(rotate)}deg` }, { scale }],
    };
  });
}

/** A tilted, die-cut sticker: toy-ink edge, white 3.5 pt ring, paper colour. News only. */
export function Sticker(props: StickerProps): ReactNode {
  const theme = useTheme();
  const shell = SHELL_COLORS[theme.scheme];
  const paper = props.paper ?? 'gold';
  const size = props.size ?? 'regular';
  const tiltDeg = props.tiltDeg ?? STK.rotateDefault;
  const slap = useSlap(tiltDeg, props);
  const ink = paper === 'ink' ? shell.cut : shell.toyInk;
  const iconSize = size === 'xs' ? STK.xs.icon : STK.icon;
  return (
    <Animated.View
      style={[
        styles.sticker,
        SIZE_STYLE[size],
        { backgroundColor: paperColor(theme, paper), borderColor: shell.toyInk },
        dieCutRing(STK.ring, shell.cut),
        slap,
      ]}
    >
      {props.icon === 'rating-star' ? <RatingStar isFilled size={iconSize} /> : null}
      {props.icon !== undefined && props.icon !== 'rating-star' ? (
        <Icon name={props.icon} color={ink} size={iconSize} />
      ) : null}
      <AppText
        text={props.text}
        variant={TEXT_STYLE[size]}
        tone={paper === 'ink' ? 'onInk' : 'toyInk'}
        testID={props.testID}
      />
    </Animated.View>
  );
}
