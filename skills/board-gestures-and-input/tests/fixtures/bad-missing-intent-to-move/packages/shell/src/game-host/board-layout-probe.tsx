// packages/shell/src/game-host/board-layout-probe.tsx
// Test builds only, and only while the debug link set boardLayout=1 (the Shell passes
// isLayoutProbeOn from its debug state; store builds always pass false). A Skia canvas has no
// accessibility nodes, so Maestro cannot find a cell: the probe publishes the board's geometry as
// one small text, `game.board-layout` = JSON.stringify({ x, y, layout }), where x and y are the
// canvas's top-left corner in window points and layout is the current BoardLayout (regions in
// canvas points, unmirrored, plus isMirrored). A flow reads it with copyTextFrom and taps
// x + region.x + (col + 0.5) * region.cell.
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@e07/shell/ui/app-text.tsx';

import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { ReactNode } from 'react';
import type { HostInstance } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

export type BoardOrigin = { readonly x: number; readonly y: number };
export type MeasureOrigin = (view: HostInstance, done: (origin: BoardOrigin) => void) => void;

export type BoardLayoutProbeProps = {
  /** The canvas's layout shared value (BoardCanvas derives it from the canvas size). */
  readonly layout: SharedValue<BoardLayout>;
  /** The canvas, drawn exactly as without the probe. */
  readonly children: ReactNode;
  /** How the frame's window position is read; Jest passes a stand-in (no native views there). */
  readonly measureOrigin?: MeasureOrigin;
};

const measureInWindow: MeasureOrigin = (view, done) => {
  view.measureInWindow((x, y) => {
    done({ x, y });
  });
};

/** The text a flow parses. */
export function boardLayoutText(origin: BoardOrigin, layout: BoardLayout): string {
  return JSON.stringify({ x: origin.x, y: origin.y, layout });
}

export function BoardLayoutProbe(props: BoardLayoutProbeProps): ReactNode {
  const { layout, children, measureOrigin = measureInWindow } = props;
  const frame = useRef<HostInstance>(null);
  const [origin, setOrigin] = useState<BoardOrigin | null>(null);
  const [current, setCurrent] = useState<BoardLayout | null>(null);
  // Layout changes only when the canvas size or the view changes, never per frame.
  useAnimatedReaction(
    () => layout.get(),
    (next) => {
      scheduleOnRN(setCurrent, next);
    },
  );
  const handleLayout = (): void => {
    if (frame.current !== null) measureOrigin(frame.current, setOrigin);
  };
  return (
    <View ref={frame} style={styles.frame} onLayout={handleLayout}>
      {children}
      {/* No text before the canvas has a size: a flow must never read the empty layout. */}
      {origin !== null && current !== null && current.width > 0 ? (
        <View style={styles.probe} pointerEvents="none">
          <AppText
            text={boardLayoutText(origin, current)}
            variant="caption"
            testID="game.board-layout"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  probe: { position: 'absolute', insetBlockStart: 0, insetInlineStart: 0 },
});
