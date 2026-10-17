// packages/shell/src/ui/screen-body.tsx
import { createContext, use, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { LAYOUT } from '@e07/shell/theme/tokens.ts';

import type { ComponentRef, ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/** Toybox block gaps: 14 by default, Settings 20, Privacy policy and Licences 18, Statistics 16. */
export type ScreenBodyGap = 'default' | 'settings' | 'long' | 'stats';

export type ScreenBodyProps = {
  readonly children: ReactNode;
  readonly gap?: ScreenBodyGap;
  /** Only when the map gives the scrolling body an id (levels.grid). */
  readonly testID?: string;
  /**
   * Tall screens without a pinned banner (S10 without its banner, S11, S11a-d, S15): the body
   * scrolls on under the home indicator, as the Toybox references draw it, and ends with the
   * page's 34 pt bottom padding (or the inset, when larger). Pair it with a ScreenFrame whose
   * edges leave out 'bottom' (UNDER_HOME_INDICATOR_EDGES).
   */
  readonly isUnderHomeIndicator?: boolean;
  /**
   * A banner band follows the body (S10): as in the design, where the band is the body's last
   * flex item, the content ends one block gap above it (the band itself is pinned outside).
   */
  readonly isAboveBanner?: boolean;
  /**
   * The first block pokes up into the top bar (S4's tilted tagline sticker: its high corner and
   * die-cut ring rise about 8 pt above its box). A scroll view clips its content, so the clip edge
   * starts OVERHANG_ROOM higher and the content is padded down by the same amount: nothing moves
   * but the edge.
   */
  readonly hasTopOverhang?: boolean;
  /**
   * Opens the body scrolled to this offset, without animation (iOS clamps it to the maximum;
   * Android scrolls a frame after each content or layout change).
   * Defaults to ScreenScrollTargetContext; only test builds set either.
   */
  readonly scrollToY?: number;
};

/**
 * Test builds only: the parity harness (reached through TEST_ONLY) wraps its root in
 * <ScreenScrollTargetContext value={request.scrollY}> so a tall frame is captured at the planned
 * offset. Nothing provides it in a store build, and ui/ never imports test-only code itself.
 */
export const ScreenScrollTargetContext = createContext<number | undefined>(undefined);

/** Draws the offset, in points, that a body's ScrollView reported last (its contentOffset.y). */
export type RenderScrollMarker = (y: number) => ReactNode;

/**
 * Test builds only: the parity harness provides what draws the offset a body really reached (its
 * invisible parity.scroll.<y> marker), so a capture measures the scroll instead of inferring it from
 * element positions. With it, the body listens to its scroll and draws the marker next to the
 * ScrollView once it has scrolled; nothing provides it in a store build, so a store body neither
 * listens nor draws anything more.
 */
export const ScreenScrollMarkerContext = createContext<RenderScrollMarker | undefined>(undefined);

/** Room above the body for a tilted sticker's corner (137 x sin 2 deg = 4.8) and its 3.5 pt ring. */
const OVERHANG_ROOM = 10;

const GAPS: Readonly<Record<ScreenBodyGap, number>> = {
  default: LAYOUT.blockGap,
  settings: LAYOUT.settingsGroupGap,
  long: LAYOUT.longPageGap,
  stats: LAYOUT.statsPageGap,
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  overhangScroll: { marginTop: -OVERHANG_ROOM },
  // flexGrow 1: a "grow" spacer pushes the hero key to the bottom while the content fits,
  // and the same column scrolls at 200 % text instead of clipping.
  content: {
    flexGrow: 1,
    paddingTop: LAYOUT.bodyPaddingTop,
    paddingInline: LAYOUT.screenGutter,
  },
  overhangContent: { paddingTop: LAYOUT.bodyPaddingTop + OVERHANG_ROOM },
});

/** Under the home indicator: max(34, inset). Otherwise ScreenFrame insets it; top up to 34. */
function bottomPaddingOf(isUnderHomeIndicator: boolean, insetBottom: number): number {
  return isUnderHomeIndicator
    ? Math.max(LAYOUT.bodyPaddingBottom, insetBottom)
    : Math.max(0, LAYOUT.bodyPaddingBottom - insetBottom);
}

/**
 * What a page that is not a ScreenBody keeps under its last block beyond the bottom inset, so it ends
 * 34 pt above the screen's edge as every Toybox page does: 0 above the iPhone's 34 pt home
 * indicator, 10 above Android's 24 dp gesture bar (the startup splash).
 */
export function useBodyBottomTopUp(): number {
  const insetBottom = use(SafeAreaInsetsContext)?.bottom ?? 0;
  return bottomPaddingOf(false, insetBottom);
}

type ReachedScrollMarker = {
  /** onScroll for the ScrollView in a test build that measures its scroll; nothing otherwise. */
  readonly scrollProps: {
    readonly onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  };
  /** The marker of the offset the body reached, once it has scrolled; null otherwise. */
  readonly marker: ReactNode;
};

/** Test builds only: the offset the body reached and its marker; nothing in a store build. */
function useReachedScrollMarker(): ReachedScrollMarker {
  const renderMarker = use(ScreenScrollMarkerContext);
  const [reachedY, setReachedY] = useState<number | null>(null);
  if (renderMarker === undefined) return { scrollProps: {}, marker: null };
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    setReachedY(event.nativeEvent.contentOffset.y);
  };
  return {
    scrollProps: { onScroll: handleScroll },
    marker: reachedY === null ? null : renderMarker(reachedY),
  };
}

/**
 * The Toybox screen body under the top bar: 6 pt top padding, 20 pt gutters, one gap between
 * blocks. The top bar stays fixed and only the body scrolls.
 */
export function ScreenBody(props: ScreenBodyProps): ReactNode {
  const { children, gap = 'default', testID } = props;
  // The context is null outside a SafeAreaProvider (component tests): treat the inset as 0.
  const insetBottom = use(SafeAreaInsetsContext)?.bottom ?? 0;
  const paddingBottom =
    props.isAboveBanner === true
      ? GAPS[gap]
      : bottomPaddingOf(props.isUnderHomeIndicator === true, insetBottom);
  const isOverhang = props.hasTopOverhang === true;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const harnessScrollY = use(ScreenScrollTargetContext);
  const scrollToY = props.scrollToY ?? harnessScrollY ?? 0;
  // From both callbacks: the first layout happens before the safe-area insets arrive, so the frame
  // is too tall and iOS clamps the offset; the later layout (same content size) scrolls again.
  // Android runs a view command before the mount items of its batch and clamps scrollTo to the
  // content it has then, so there the body scrolls a frame later, once the grown content is mounted.
  const scrollToTarget = (): void => {
    scroll.current?.scrollTo({ y: scrollToY, animated: false });
  };
  const handleScrollTarget = (): void => {
    if (scrollToY <= 0) return;
    if (Platform.OS === 'android') requestAnimationFrame(scrollToTarget);
    else scrollToTarget();
  };
  const { scrollProps, marker } = useReachedScrollMarker();
  const body = (
    <ScrollView
      ref={scroll}
      onContentSizeChange={handleScrollTarget}
      onLayout={handleScrollTarget}
      style={[styles.scroll, isOverhang ? styles.overhangScroll : null]}
      contentContainerStyle={[
        styles.content,
        { gap: GAPS[gap], paddingBottom },
        isOverhang ? styles.overhangContent : null,
      ]}
      {...(testID === undefined ? {} : { testID })}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  );
  // The marker sits next to the ScrollView, not inside it: a child of the content would scroll off
  // the screen, and Maestro does not list what is off the screen. The tree has this shape from the
  // first render, so the marker's arrival never remounts the ScrollView.
  return (
    <>
      {body}
      {marker}
    </>
  );
}
