// packages/shell/src/game-host/game-board-host.tsx
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { BoardCanvas } from './board-canvas.tsx';
import { makeScene } from './board-scene.ts';
import { createCueScheduler } from './cue-scheduler.ts';
import { presentMove } from './present-move.ts';
import { useBoardClock } from './use-board-clock.ts';
import { useGameLifecycle } from './use-game-lifecycle.ts';

import type { BoardClockLabel } from './board-clock-state.ts';
import type {
  BoardColors,
  BoardHighlight,
  GameBoard,
  RenderKit,
  ViewFormat,
} from './board-types.ts';
import type { PanMode } from './pan-intent.ts';
import type { MoveResult } from './present-move.ts';
import type { ClockTraceSample } from './use-board-clock.ts';
import type { RunnableFlags } from './use-game-lifecycle.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

/** One board-clock trace entry's data (test builds): the clock's numbers and the lifecycle facts. */
export type BoardClockTraceData = ClockTraceSample & RunnableFlags;
/** Test builds with boardLayout=1: appends { kind: 'board-clock', label, data } to the perf log. */
export type BoardClockTrace = (label: BoardClockLabel, data: BoardClockTraceData) => void;
/** Test builds: S15's "Record frame times", a worklet the frame callback calls with each dt. */
export type BoardFrameTime = (dtMs: number | null) => void;

export type GameBoardHostProps<TState, TEvent, TView, TToken extends string> = {
  readonly board: GameBoard<TState, TView, TToken>;
  readonly buildTimeline: (events: readonly TEvent[], motion: Motion) => readonly Track[];
  /** Latest committed move from the GameSession store (already saved). */
  readonly result: MoveResult<TState, TEvent>;
  readonly format: ViewFormat;
  readonly motion: Motion;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
  /**
   * The host's UI-only selection (a tap in one of GameEngine.selectRegions) and the hinted move's
   * targets; EMPTY_HIGHLIGHT when there are none. draw() reads it as frame.highlight.
   */
  readonly highlight: BoardHighlight;
  readonly isRtl: boolean;
  readonly panMode: PanMode;
  readonly accessibilityLabel: string;
  readonly audio: AudioPort;
  readonly haptics: HapticsPort;
  readonly isFocused: boolean;
  readonly isFullscreenAdShowing: boolean;
  readonly onIntent: (intent: InputIntent) => void;
  readonly onHover: (target: BoardTarget | null) => void;
  /** A tap outside every region (the host clears its tap-then-tap selection). */
  readonly onMiss?: () => void;
  /** Pause the game and write the local error log (errors never crash the app). */
  readonly onFailure: (message: string) => void;
  /** `(error) => errorLog.record('audio', error)` for non-fatal audio session failures. */
  readonly reportError: (error: unknown) => void;
  /** Test builds only: the debug link's boardLayout=1 (store builds leave it out). */
  readonly isLayoutProbeOn?: boolean;
  /** Test builds only, while boardLayout=1: the board-clock trace (store builds leave it out). */
  readonly traceClock?: BoardClockTrace;
  /** Test builds only: S15's frame recorder, fed from the board's frame callback. */
  readonly onFrameTime?: BoardFrameTime;
};

const NO_FLAGS: RunnableFlags = { isAppActive: false, isFocused: false, isAdShowing: false };

/** Board area of S5: clock + presenter + cues + lifecycle around one BoardCanvas. */
export function GameBoardHost<TState, TEvent, TView, TToken extends string>(
  props: GameBoardHostProps<TState, TEvent, TView, TToken>,
): React.JSX.Element {
  const { board, result, format, audio, haptics } = props;
  const toView = (state: TState): TView => board.toView(state, format);
  const flags = useRef(NO_FLAGS);
  const { traceClock } = props;
  const trace =
    traceClock === undefined
      ? null
      : (label: BoardClockLabel, sample: ClockTraceSample): void => {
          traceClock(label, { ...sample, ...flags.current });
        };
  const clock = useBoardClock(makeScene(result.seq, toView(result.state), []), props.onFailure, {
    trace,
    onFrameTime: props.onFrameTime ?? null,
  });
  const [cues] = useState(() => createCueScheduler(audio, haptics));
  const present = useEffectEvent((next: MoveResult<TState, TEvent>) => {
    const deps = { toView, buildTimeline: props.buildTimeline, motion: props.motion, clock, cues };
    presentMove(deps, next);
  });
  useEffect(() => {
    present(result);
  }, [result]);
  useGameLifecycle({
    isFocused: props.isFocused,
    isFullscreenAdShowing: props.isFullscreenAdShowing,
    onPause: () => {
      clock.stop();
      cues.cancel();
      audio.suspend().catch(props.reportError);
    },
    onResume: () => {
      audio.resume().catch(props.reportError);
      clock.resume();
    },
    onFlags: (next) => {
      flags.current = next;
      clock.trace('runnable');
    },
  });
  return (
    <BoardCanvas
      board={board}
      clock={clock}
      colors={props.colors}
      kit={props.kit}
      highlight={props.highlight}
      isRtl={props.isRtl}
      panMode={props.panMode}
      accessibilityLabel={props.accessibilityLabel}
      onIntent={props.onIntent}
      onHover={props.onHover}
      {...(props.onMiss === undefined ? {} : { onMiss: props.onMiss })}
      onDrawError={props.onFailure}
      isLayoutProbeOn={props.isLayoutProbeOn === true}
    />
  );
}
