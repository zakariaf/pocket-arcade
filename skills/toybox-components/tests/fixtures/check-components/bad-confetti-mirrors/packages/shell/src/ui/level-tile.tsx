// packages/shell/src/ui/level-tile.tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { EASING, KEYFRAMES, MOTION_MS, PRESS_SQUASH } from '@e07/shell/theme/motion.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';
import { RaisedSurface } from './raised-surface.tsx';
import { RatingStars } from './rating-stars.tsx';
import { dieCutRing, focusRing } from './toybox-styles.ts';

import type { Theme } from '@e07/shell/theme/theme-types.ts';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

const TILE = COMPONENT_SPECS.levelTile;
const FLAG = TILE.flag;
const BOB_HALF = { duration: MOTION_MS.bob / 2, easing: Easing.bezier(...EASING.easeInOut) };

/** completed (1 to 3 stars) · current (the next level: accent, flag, bobbing) · locked. */
export type LevelTileState =
  | { readonly kind: 'completed'; readonly stars: 1 | 2 | 3 }
  | { readonly kind: 'current' }
  | { readonly kind: 'locked' };

export type LevelTileProps = {
  /** The level number in the chosen digits ("12" or "۱۲"). */
  readonly numberText: string;
  readonly state: LevelTileState;
  /** Translated VoiceOver label ("Level 12: 2 stars", "Level 13, locked"). */
  readonly label: string;
  /** Translated hint for locked tiles ("Shows how to unlock this level."). */
  readonly hint?: string;
  readonly onPress: () => void;
  /** `levels.level-tile.<n>`: parts `.number`, `.stars-<k>`, `.flag`. */
  readonly testID: string;
  readonly isReducedMotion: boolean;
  /** Column width from the grid layout (6 columns on phones). */
  readonly width: number;
  /** The tapped locked tile shows the focus ring while its toast is up. */
  readonly isFocused?: boolean;
};

const styles = StyleSheet.create({
  // minHeight, not height: at 200 % text the number and stars grow the tile instead of clipping.
  face: { minHeight: TILE.height, gap: TILE.gap, paddingInline: 0 },
  flag: {
    position: 'absolute',
    top: FLAG.top,
    end: FLAG.end,
    width: FLAG.size,
    height: FLAG.size,
    borderRadius: FLAG.radius,
    borderWidth: FLAG.border,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: `${String(FLAG.rotate)}deg` }],
  },
});

type Paint = {
  readonly fill: string;
  readonly edge: string;
  readonly ink: string;
  readonly tone: 'default' | 'onPrimary' | 'muted';
};

function paintOf(theme: Theme, state: LevelTileState): Paint {
  const { colors } = theme;
  if (state.kind === 'current')
    return { fill: colors.primary, edge: colors.border, ink: colors.onPrimary, tone: 'onPrimary' };
  if (state.kind === 'locked')
    return { fill: colors.sunken, edge: colors.textMuted, ink: colors.textMuted, tone: 'muted' };
  return { fill: colors.surface, edge: colors.border, ink: colors.icon, tone: 'default' };
}

function faceOf(theme: Theme, props: LevelTileProps): ViewStyle {
  const isLocked = props.state.kind === 'locked';
  return {
    width: props.width,
    ...(isLocked ? { borderStyle: 'dashed' } : {}),
    ...(props.isFocused === true ? focusRing(theme.colors.focus) : {}),
  };
}

function useBob(isOn: boolean): ReturnType<typeof useAnimatedStyle> {
  const offset = useSharedValue(0);
  useEffect(() => {
    if (!isOn) return undefined;
    offset.set(
      withRepeat(
        withSequence(withTiming(KEYFRAMES.bob.translateY, BOB_HALF), withTiming(0, BOB_HALF)),
        -1,
      ),
    );
    return () => {
      offset.set(0);
    };
  }, [isOn, offset]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
}

/** The gold flag sticker at the current tile's top-end corner (a plain function, not a component). */
function flag(theme: Theme, testID: string): ReactNode {
  const shell = SHELL_COLORS[theme.scheme];
  return (
    <View
      style={[
        styles.flag,
        { backgroundColor: shell.gold, borderColor: shell.toyInk },
        dieCutRing(FLAG.ring, shell.cut),
      ]}
      testID={testID}
    >
      <Icon name="play" color={shell.toyInk} size={FLAG.icon} />
    </View>
  );
}

/** Under the number: a padlock on locked tiles, otherwise three mini stars. */
function tileFoot(props: LevelTileProps, paint: Paint, theme: Theme): ReactNode {
  const { state } = props;
  if (state.kind === 'locked') return <Icon name="lock" color={paint.ink} size={TILE.lockIcon} />;
  const stars = state.kind === 'current' ? 0 : state.stars;
  return (
    <RatingStars
      count={stars}
      size="mini"
      testID={`${props.testID}.stars-${String(stars)}`}
      {...(state.kind === 'current' ? { hollowColor: theme.colors.onPrimary } : {})}
    />
  );
}

/** A level on the S8 grid: number plus mini stars, the current one with a flag, locked ones dashed. */
export function LevelTile(props: LevelTileProps): ReactNode {
  const theme = useTheme();
  const { state } = props;
  const paint = paintOf(theme, state);
  const isCurrent = state.kind === 'current';
  const bob = useBob(isCurrent && !props.isReducedMotion);
  return (
    <Animated.View style={bob}>
      <RaisedSurface
        label={props.label}
        onPress={props.onPress}
        testID={props.testID}
        {...(props.hint === undefined ? {} : { hint: props.hint })}
        elevation={TILE.elevation}
        radius={TILE.radius}
        edgeWidth={isCurrent ? TILE.borderCurrent : TILE.border}
        edgeColor={paint.edge}
        fill={paint.fill}
        squash={PRESS_SQUASH.levelTile}
        isPushedIn={state.kind === 'locked'}
        isReducedMotion={props.isReducedMotion}
        faceStyle={[styles.face, faceOf(theme, props)]}
      >
        <AppText
          text={props.numberText}
          variant="levelNumber"
          tone={paint.tone}
          align="center"
          testID={`${props.testID}.number`}
        />
        {tileFoot(props, paint, theme)}
        {isCurrent ? flag(theme, `${props.testID}.flag`) : null}
      </RaisedSurface>
    </Animated.View>
  );
}
