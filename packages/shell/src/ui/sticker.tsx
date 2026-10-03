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

import { useDirection } from '@e07/shell/i18n/direction-context.tsx';
import { EASING, KEYFRAMES, MOTION_MS } from '@e07/shell/theme/motion.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { RatingStar } from './rating-star.tsx';
import { dieCutRing } from './toybox-styles.ts';

import type { IconName } from './icons/icon-paths.ts';
import type { Direction } from '@e07/shell/i18n/languages.ts';
import type { Theme } from '@e07/shell/theme/theme-types.ts';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

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
});

type StickerPads = {
  readonly block: number;
  readonly left: number;
  readonly right: number;
  readonly gap: number;
};

/**
 * The Toybox sticker pads physically (CSS `padding: 5px 11px 5px 9px`): 9 on the left, 11 on the
 * right, in both directions, so in right-to-left the larger pad sits next to the icon. The token
 * file names them paddingStart / paddingEnd as seen left to right.
 */
const PADS: Readonly<Record<StickerSize, StickerPads>> = {
  regular: { block: STK.paddingBlock, left: STK.paddingStart, right: STK.paddingEnd, gap: STK.gap },
  sm: {
    block: STK.sm.paddingBlock,
    left: STK.sm.paddingStart,
    right: STK.sm.paddingEnd,
    gap: STK.gap,
  },
  xs: {
    block: STK.xs.paddingBlock,
    left: STK.xs.paddingStart,
    right: STK.xs.paddingEnd,
    gap: STK.xs.gap,
  },
};
const TEXT_STYLE = { regular: 'sticker', sm: 'stickerSm', xs: 'stickerXs' } as const;

/** Physical pads through logical keys (physical keys are banned): start and end swap in RTL. */
function padStyle(size: StickerSize, direction: Direction): ViewStyle {
  const pad = PADS[size];
  const isRtl = direction === 'rtl';
  return {
    paddingBlock: pad.block,
    paddingStart: isRtl ? pad.right : pad.left,
    paddingEnd: isRtl ? pad.left : pad.right,
    gap: pad.gap,
  };
}

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

/**
 * A tilted, die-cut sticker: toy-ink edge, white 3.5 pt ring, paper colour. News only. The paper is
 * one accessible text element with the testID, so Maestro and the parity bounds measure the whole
 * tilted sticker, not its inner text.
 */
export function Sticker(props: StickerProps): ReactNode {
  const theme = useTheme();
  const direction = useDirection();
  const shell = SHELL_COLORS[theme.scheme];
  const paper = props.paper ?? 'gold';
  const size = props.size ?? 'regular';
  const tiltDeg = props.tiltDeg ?? STK.rotateDefault;
  const slap = useSlap(tiltDeg, props);
  const ink = paper === 'ink' ? shell.cut : shell.toyInk;
  const iconSize = size === 'xs' ? STK.xs.icon : STK.icon;
  return (
    <Animated.View
      testID={props.testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={props.text}
      style={[
        styles.sticker,
        padStyle(size, direction),
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
      />
    </Animated.View>
  );
}
