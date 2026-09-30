// packages/shell/src/game-host/game-board-host.tsx
import { useEffect, useEffectEvent, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { BoardCanvas } from './board-canvas.tsx';
import { makeScene } from './board-scene.ts';
import { createCueScheduler } from './cue-scheduler.ts';
import { presentMove } from './present-move.ts';
import { useBoardClock } from './use-board-clock.ts';
import { useGameLifecycle } from './use-game-lifecycle.ts';

import type { BoardColors, GameBoard, RenderKit, ViewFormat } from './board-types.ts';
import type { PanMode } from './pan-intent.ts';
import type { MoveResult } from './present-move.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

export type GameBoardHostProps<TState, TEvent, TView, TToken extends string> = {
  readonly board: GameBoard<TState, TView, TToken>;
  readonly buildTimeline: (events: readonly TEvent[], motion: Motion) => readonly Track[];
  /** Latest committed move from the GameSession store (already saved). */
  readonly result: MoveResult<TState, TEvent>;
  readonly format: ViewFormat;
  readonly motion: Motion;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
  readonly isRtl: boolean;
  readonly panMode: PanMode;
  readonly accessibilityLabel: string;
  readonly audio: AudioPort;
  readonly haptics: HapticsPort;
  readonly isFocused: boolean;
  readonly isFullscreenAdShowing: boolean;
  readonly onIntent: (intent: InputIntent) => void;
  readonly onHover: (target: BoardTarget | null) => void;
  /** Pause the game and write the local error log (errors never crash the app). */
  readonly onFailure: (message: string) => void;
  /** `(error) => errorLog.record('audio', error)` for non-fatal audio session failures. */
  readonly reportError: (error: unknown) => void;
};

/** Board area of S5: clock + presenter + cues + lifecycle around one BoardCanvas. */
export function GameBoardHost<TState, TEvent, TView, TToken extends string>(
  props: GameBoardHostProps<TState, TEvent, TView, TToken>,
): React.JSX.Element {
  const { board, result, format, audio, haptics } = props;
  const isReduced = useReducedMotion();
  const toView = (state: TState): TView => board.toView(state, format);
  const clock = useBoardClock(makeScene(result.seq, toView(result.state), []), props.onFailure);
  const [cues] = useState(() => createCueScheduler(audio, haptics));
  const present = useEffectEvent((next: MoveResult<TState, TEvent>) => {
    const deps = { toView, buildTimeline: props.buildTimeline, motion: isReduced ? 'reduced' : props.motion, clock, cues };
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
  });
  return (
    <BoardCanvas
      board={board}
      clock={clock}
      colors={props.colors}
      kit={props.kit}
      isRtl={props.isRtl}
      panMode={props.panMode}
      accessibilityLabel={props.accessibilityLabel}
      onIntent={props.onIntent}
      onHover={props.onHover}
      onDrawError={props.onFailure}
    />
  );
}
