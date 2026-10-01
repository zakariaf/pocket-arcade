// packages/shell/src/ui/screen-body.tsx
import { createContext, use, useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { LAYOUT } from '@e07/shell/theme/tokens.ts';

import type { ComponentRef, ReactNode } from 'react';

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
   * Opens the body scrolled to this offset, without animation (iOS clamps it to the maximum).
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
  const handleScrollTarget = (): void => {
    if (scrollToY > 0) scroll.current?.scrollTo({ y: scrollToY, animated: false });
  };
  return (
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
    >
      {children}
    </ScrollView>
  );
}
