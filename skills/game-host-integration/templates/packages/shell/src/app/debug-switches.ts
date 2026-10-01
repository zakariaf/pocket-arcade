// packages/shell/src/app/debug-switches.ts
// The game host's test-build switches, read through the debug parts once createDebugParts made
// them (all off in a store build: no debug services, TEST_ONLY null). The board-layout probe is on
// for the debug link's boardLayout=1 and for a parity probe=board launch, whose capture masks the
// board; the debug controls' openExample pushes the Game route on the debug navigator. The host
// exists before the debug parts (they need its debug controls), so it plays the Shell's feedback
// (win, lose, tap, toggle) through debugFeedbackOf, which asks for parts.feedback at call time: the
// test build's recording ports (the E2E feedback evidence), else the real ports. While the board
// probe is on (boardLayout=1), the board also traces its clock into the perf log ('board-clock'
// entries), and S15's "Record frame times" samples the board's frame callback.
import { StackActions } from '@react-navigation/native';

import { sampleFrame } from '@e07/shell/app/perf/use-frame-recorder.ts';
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

import type { DebugParts } from '@e07/shell/app/create-debug-parts.ts';
import type { BoardClockTrace, BoardFrameTime } from '@e07/shell/game-host/game-board-host.tsx';
import type { GameParams } from '@e07/shell/navigation/route-params.ts';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { FeedbackPorts } from '@e07/shell/services/audio/ui-feedback.ts';

/** The board host factory's test-build ports (createGameBoardHost spreads them into BoardPorts). */
export type BoardSwitches = {
  /** The board's game.board-layout probe (board-rendering-skia), read while the board draws. */
  readonly isLayoutProbeOn: () => boolean;
  /** The board-clock trace while boardLayout=1 is on; undefined otherwise (store builds too). */
  readonly traceClock: () => BoardClockTrace | undefined;
  /** S15's frame recorder as a worklet for the board's frame callback; undefined in a store build. */
  readonly frameTime: () => BoardFrameTime | undefined;
};

export type DebugSwitches = {
  readonly board: BoardSwitches;
  /** The debug link's seed=, read when an endless run starts. */
  readonly seedOverride: () => number | null;
  /** The debug controls' openExample: a new Game screen on top. */
  readonly openGame: (params: GameParams) => void;
};

/** One function per debug services object, so the board's frame callback keeps its identity. */
function cachedFor<T>(make: (services: DebugServices) => T): (services: DebugServices) => T {
  let cached: { readonly services: DebugServices; readonly value: T } | null = null;
  return (services) => {
    if (cached?.services !== services) cached = { services, value: make(services) };
    return cached.value;
  };
}

/** parts() is null until the composition root has created the debug parts. */
export function debugSwitchesOf(
  parts: () => DebugParts | null,
  nowMs: () => number,
): DebugSwitches {
  const traceOf = cachedFor<BoardClockTrace>((services) => (label, data) => {
    services.perfLog.append({ kind: 'board-clock', label, atEpochMs: nowMs(), data });
  });
  const frameTimeOf = cachedFor<BoardFrameTime>((services) => {
    const { histogram, isRecording } = services.perf.frames;
    return (dtMs) => {
      'worklet';
      sampleFrame(histogram, isRecording, dtMs);
    };
  });
  const board: BoardSwitches = {
    isLayoutProbeOn: () =>
      parts()?.services?.isBoardLayoutOn() === true || TEST_ONLY?.isParityBoardProbeOn() === true,
    traceClock: () => {
      const services = parts()?.services ?? null;
      return services?.isBoardLayoutOn() === true ? traceOf(services) : undefined;
    },
    frameTime: () => {
      const services = parts()?.services ?? null;
      return services === null ? undefined : frameTimeOf(services);
    },
  };
  return {
    board,
    seedOverride: () => parts()?.services?.seedOverride() ?? null,
    openGame: (params) => {
      parts()?.navigationRef.dispatch(StackActions.push('Game', params));
    },
  };
}

/**
 * The ports the host plays the Shell's feedback through: the debug parts' recording ports once
 * they exist (test builds: every cue also lands in the perf log), else the real ones (store builds,
 * and the moments before createDebugParts ran).
 */
export function debugFeedbackOf(
  parts: () => DebugParts | null,
  ports: FeedbackPorts,
): FeedbackPorts {
  const current = (): FeedbackPorts => parts()?.feedback ?? ports;
  return {
    audio: {
      ...ports.audio,
      play: (soundId, delayMs) => {
        current().audio.play(soundId, delayMs);
      },
    },
    haptics: {
      isSupported: ports.haptics.isSupported,
      play: (cue) => {
        current().haptics.play(cue);
      },
    },
  };
}
