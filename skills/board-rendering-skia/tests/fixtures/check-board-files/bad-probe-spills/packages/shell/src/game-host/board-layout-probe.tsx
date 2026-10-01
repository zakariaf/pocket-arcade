// packages/shell/src/game-host/board-layout-probe.tsx
// Test builds only, and only while the debug link set boardLayout=1 or a parity launch set
// probe=board (the Shell passes isLayoutProbeOn from its debug state and isParityBoardProbeOn();
// store builds always pass false). A Skia canvas has no accessibility nodes, so Maestro cannot
// find a cell: the probe publishes the board's geometry as one small text, `game.board-layout` =
// JSON.stringify({ x, y, layout }), where x and y are the canvas's top-left corner in window
// points and layout is the current BoardLayout (regions in canvas points, unmirrored, plus
// isMirrored). An E2E flow reads it with copyTextFrom and taps x + region.x + (col + 0.5) *
// region.cell; a parity capture reads it once to mask the board of S5, S6 and S7, which have no
// board reference. The frame clips and the text wraps inside it, so the probe never draws over
// the Shell chrome that parity compares.
// Given the clock's scene and now, it also publishes `game.board-frame` = {"seq":<n>,"settled":<b>}:
// the seq of the scene the picture shows and whether the picture was recorded at that scene's end
// (boardFrameOf, read on the UI thread from the same values the picture is recorded from). A flow
// waits for settled true after a move, a continue or a full-screen ad; a board whose clock stopped
// early keeps settled false (the frozen board after a rewarded continue, 2026-10-01).
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@e07/shell/ui/app-text.tsx';

import { boardFrameOf, boardFrameText } from './board-clock-state.ts';

import type { BoardFrame } from './board-clock-state.ts';
import type { BoardScene } from './board-scene.ts';
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
  /** The clock's scene and now: also publish game.board-frame. */
  readonly clock?: {
    readonly scene: { readonly get: () => Pick<BoardScene<unknown>, 'seq' | 'startAt' | 'endMs'> };
    readonly now: { readonly get: () => number };
  };
};

const NO_SCENE = { seq: -1, startAt: 0, endMs: 0 };

/** game.board-frame: changes when the seq or settled changes, never per frame. */
function useBoardFrame(clock: BoardLayoutProbeProps['clock']): BoardFrame | null {
  const [frame, setFrame] = useState<BoardFrame | null>(null);
  const isOn = clock !== undefined;
  useAnimatedReaction(
    () =>
      clock === undefined
        ? boardFrameOf(NO_SCENE, 0)
        : boardFrameOf(clock.scene.get(), clock.now.get()),
    (next, previous) => {
      if (!isOn || (previous?.seq === next.seq && previous.settled === next.settled)) return;
      scheduleOnRN(setFrame, next);
    },
  );
  return frame;
}

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
  const boardFrame = useBoardFrame(props.clock);
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
          {boardFrame === null ? null : (
            <AppText
              text={boardFrameText(boardFrame)}
              variant="caption"
              testID="game.board-frame"
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  probe: { position: 'absolute', insetBlockStart: 0, insetInlineStart: 0, insetInlineEnd: 0 },
});
