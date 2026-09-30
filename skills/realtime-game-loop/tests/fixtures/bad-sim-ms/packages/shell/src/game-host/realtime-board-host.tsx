// packages/shell/src/game-host/realtime-board-host.tsx
// Board area of S5 for a real-time game: the fixed-step loop, the live picture, the stick input
// and the lifecycle, around ONE Skia canvas. Turn-based games use GameBoardHost instead.
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { recordSim } from './record-sim.ts';
import { useFixedStepLoop } from './use-fixed-step-loop.ts';
import { useGameLifecycle } from './use-game-lifecycle.ts';

import type { BoardColors, RenderKit } from './board-types.ts';
import type { SimFrame } from './record-sim.ts';
import type { FixedStepSim } from './use-fixed-step-loop.ts';
import type { SkCanvas, SkSize } from '@shopify/react-native-skia';
import type { ComposedGesture, GestureType } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

export type RealtimeBoardHostProps<TSim, TToken extends string> = {
  /** Created once by the Game screen (createSim(seed, level)) or restored from a save point. */
  readonly initialSim: TSim;
  readonly game: FixedStepSim<TSim>;
  /** Worklet: paints the live sim. Must not allocate Skia objects or read clocks. */
  readonly draw: (canvas: SkCanvas, frame: SimFrame<TSim, TToken>) => void;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
  /** Builds the input gesture that writes the integer command (the stick builder). */
  readonly makeGesture: (command: SharedValue<number>) => ComposedGesture | GestureType;
  /** Already translated with t(). */
  readonly accessibilityLabel: string;
  readonly isFocused: boolean;
  readonly isFullscreenAdShowing: boolean;
  /** The Game screen's pause state (S6). The loop runs only while this is false. */
  readonly isPaused: boolean;
  /** The run is over (a death or time-up event arrived): the loop stops with no save point and no Pause. */
  readonly isEnded: boolean;
  /** JS: batched sim events [kind, value, tick, …], at most once per frame. */
  readonly onEvents: (events: readonly number[]) => void;
  /** JS: true when a batch holds a save-point event (wave end): the game module's isSavePoint. */
  readonly isSavePoint: (events: readonly number[]) => boolean;
  /** JS: a copy of the sim at a save point (wave end, pause, background, blur, ad). Save it with the input log. */
  readonly onSavePoint: (sim: TSim) => void;
  /** JS: the loop stopped for a lifecycle reason; show Pause (real-time games never auto-resume). */
  readonly onAutoPause: () => void;
  /** Pause the game and write the local error log. */
  readonly onFailure: (message: string) => void;
};

export function RealtimeBoardHost<TSim, TToken extends string>(
  props: RealtimeBoardHostProps<TSim, TToken>,
): React.JSX.Element {
  const { colors, kit, draw, onFailure } = props;
  const sim = useSharedValue(props.initialSim);
  const command = useSharedValue(0);
  const size = useSharedValue<SkSize>({ width: 0, height: 0 });
  const [recorder] = useState(() => Skia.PictureRecorder());
  const handleEvents = (events: readonly number[]): void => {
    // sim.get() on JS is a synchronous copy taken between two frames, so it is consistent.
    if (props.isSavePoint(events)) props.onSavePoint(sim.get());
    props.onEvents(events);
  };
  const loop = useFixedStepLoop({
    sim,
    command,
    game: props.game,
    onEvents: handleEvents,
    onError: onFailure,
  });
  useGameLifecycle({
    isFocused: props.isFocused && !props.isPaused && !props.isEnded,
    isFullscreenAdShowing: props.isFullscreenAdShowing,
    onPause: () => {
      loop.stop();
      // The Game screen records a finished run itself (outcome, stars, statistics) and shows the result.
      if (props.isEnded) return;
      props.onSavePoint(sim.get());
      props.onAutoPause();
    },
    onResume: () => {
      loop.start();
    },
  });
  const reportDrawError = (message: string): void => {
    'worklet';
    scheduleOnRN(onFailure, message);
  };
  const picture = useDerivedValue(() => {
    const { width, height } = size.get();
    return recordSim(recorder, {
      sim: sim.get(),
      width,
      height,
      colors,
      kit,
      draw,
      onError: reportDrawError,
    });
  });
  return (
    <GestureDetector gesture={props.makeGesture(command)}>
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
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
