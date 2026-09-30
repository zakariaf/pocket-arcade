// packages/shell/src/game-host/board-canvas.tsx
// device-only: covered by the e2e level flow and the simulator board screenshots (a Skia Canvas; unit Jest has no Skia).
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { EMPTY_LAYOUT } from '@e07/game-kit/geom/board-layout.ts';

import { BoardLayoutProbe } from './board-layout-probe.tsx';
import { recordBoard } from './record-board.ts';
import { useBoardGestures } from './use-board-gestures.ts';

import type { BoardColors, BoardHighlight, GameBoard, RenderKit } from './board-types.ts';
import type { PanMode } from './pan-intent.ts';
import type { BoardClock } from './use-board-clock.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
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
  readonly onDrawError: (message: string) => void;
  /** Test builds with the debug link's boardLayout=1 only: publish game.board-layout for flows. */
  readonly isLayoutProbeOn?: boolean;
};

export function BoardCanvas<TState, TView, TToken extends string>(
  props: BoardCanvasProps<TState, TView, TToken>,
): React.JSX.Element {
  const { board, clock, colors, kit, highlight, onDrawError } = props;
  // One recorder per canvas, reused every frame; created in render, never at import time.
  const [recorder] = useState(() => Skia.PictureRecorder());
  const isMirrored = props.isRtl && board.isMirroredInRtl;
  const size = useSharedValue<SkSize>({ width: 0, height: 0 });

  const layout = useDerivedValue(() => {
    const { width, height } = size.get();
    return width === 0
      ? EMPTY_LAYOUT
      : board.layout({ width, height, view: clock.scene.get().view, isMirrored });
  });
  const { gesture, pointer } = useBoardGestures(layout, {
    panMode: props.panMode,
    dragLiftPt: board.dragLiftPt ?? 0,
    onIntent: props.onIntent,
    onHover: props.onHover,
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
      draw: board.draw,
      onError: reportDrawError,
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
    <BoardLayoutProbe layout={layout}>{canvas}</BoardLayoutProbe>
  ) : (
    canvas
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
