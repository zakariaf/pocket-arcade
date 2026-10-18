// packages/shell/src/game-host/board-canvas.tsx
// device-only: covered by the e2e level flow and the simulator board screenshots (a Skia Canvas; unit Jest has no Skia).
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { EMPTY_LAYOUT } from '@e07/game-kit/geom/board-layout.ts';

import { BoardLayoutProbe } from './board-layout-probe.tsx';
import { COACH_HAND_LOOP_MS, COACH_HAND_LOOPS, coachHandKey } from './draw-coach-hand.ts';
import { recordBoard } from './record-board.ts';
import { useBoardGestures } from './use-board-gestures.ts';

import type { BoardColors, BoardHighlight, GameBoard, RenderKit } from './board-types.ts';
import type { PanMode } from './pan-intent.ts';
import type { CoachHandInput } from './record-board.ts';
import type { BoardClock } from './use-board-clock.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { Motion } from '@e07/game-kit/timeline/track.ts';
import type { SkSize } from '@shopify/react-native-skia';

export type BoardCanvasProps<TState, TView, TToken extends string> = {
  readonly board: GameBoard<TState, TView, TToken>;
  readonly clock: BoardClock<TView>;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
  /** The host's selection and hinted targets; changes on taps and hints, never per frame. */
  readonly highlight: BoardHighlight;
  readonly isRtl: boolean;
  readonly panMode: PanMode;
  /** Already translated with t() from board.describe(view). */
  readonly accessibilityLabel: string;
  readonly onIntent: (intent: InputIntent) => void;
  readonly onHover: (target: BoardTarget | null) => void;
  /** A tap outside every region: the host drops its tap-then-tap selection. */
  readonly onMiss?: () => void;
  /** The clock's fail: it halts the clock and reports the first error of a run once. */
  readonly onDrawError: (message: string) => void;
  /** Test builds with the debug link's boardLayout=1 only: publish game.board-layout for flows. */
  readonly isLayoutProbeOn?: boolean;
  /** The tutorial's pointing hand (null: none) and how often it was asked to play again. */
  readonly coach?: BoardCoachHand | null;
  /** Reduce motion: the hand then rests at the gap instead of gliding there. */
  readonly motion?: Motion;
};

/** The hand the board draws over its picture, and its replay count (a refused move bumps it). */
export type BoardCoachHand = Omit<CoachHandInput, 'phase'> & { readonly replay: number };

/**
 * The hand's phase: it glides from the slot to the gap COACH_HAND_LOOPS times, again each time
 * the replay count grows (a refused tutorial move), and rests at the gap under reduced motion.
 */
function useCoachHandPhase(coach: BoardCoachHand | null, motion: Motion): { get: () => number } {
  const phase = useSharedValue(1);
  const key = coachHandKey(coach);
  useEffect(() => {
    cancelAnimation(phase);
    if (key === null || motion === 'reduced') {
      phase.set(1);
      return;
    }
    phase.set(0);
    const loop = withTiming(1, { duration: COACH_HAND_LOOP_MS, easing: Easing.linear });
    phase.set(withRepeat(loop, COACH_HAND_LOOPS, false));
  }, [key, motion, phase]);
  return phase;
}

export function BoardCanvas<TState, TView, TToken extends string>(
  props: BoardCanvasProps<TState, TView, TToken>,
): React.JSX.Element {
  const { board, clock, colors, kit, highlight, onDrawError } = props;
  const coach = props.coach ?? null;
  const handPhase = useCoachHandPhase(coach, props.motion ?? 'full');
  // The worklets below capture only the two worklet functions they call, not the whole board
  // (whose describe, toView, targetsOfMove and buildPaths would be copied to the UI runtime).
  const { layout: layoutBoard, draw } = board;
  // One recorder per canvas, reused every frame; created in render, never at import time.
  const [recorder] = useState(() => Skia.PictureRecorder());
  const isMirrored = props.isRtl && board.isMirroredInRtl;
  const size = useSharedValue<SkSize>({ width: 0, height: 0 });

  const layout = useDerivedValue(() => {
    const { width, height } = size.get();
    return width === 0
      ? EMPTY_LAYOUT
      : layoutBoard({ width, height, view: clock.scene.get().view, isMirrored });
  });
  const { gesture, pointer } = useBoardGestures(layout, {
    panMode: props.panMode,
    dragLiftPt: board.dragLiftPt ?? 0,
    onIntent: props.onIntent,
    onHover: props.onHover,
    ...(props.onMiss === undefined ? {} : { onMiss: props.onMiss }),
  });
  const reportDrawError = (message: string): void => {
    'worklet';
    scheduleOnRN(onDrawError, message);
  };
  const picture = useDerivedValue(() =>
    recordBoard(recorder, {
      scene: clock.scene.get(),
      now: clock.now.get(),
      layout: layout.get(),
      pointer: pointer.get(),
      highlight,
      colors,
      kit,
      draw,
      onError: reportDrawError,
      coach: coach === null ? null : { ...coach, phase: handPhase.get() },
    }),
  );

  const canvas = (
    <GestureDetector gesture={gesture}>
      <Canvas
        style={styles.canvas}
        onSize={size}
        opaque
        accessible
        accessibilityRole="image"
        accessibilityLabel={props.accessibilityLabel}
      >
        <Picture picture={picture} />
      </Canvas>
    </GestureDetector>
  );
  return props.isLayoutProbeOn === true ? (
    <BoardLayoutProbe layout={layout} clock={clock}>
      {canvas}
    </BoardLayoutProbe>
  ) : (
    canvas
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
