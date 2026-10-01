// packages/shell/src/app/debug-switches.ts
// The game host's test-build switches, read through the debug parts once createDebugParts made
// them (all off in a store build: no debug services, TEST_ONLY null). The board-layout probe is on
// for the debug link's boardLayout=1 and for a parity probe=board launch, whose capture masks the
// board; the debug controls' openExample pushes the Game route on the debug navigator. The host
// exists before the debug parts (they need its debug controls), so it plays the Shell's feedback
// (win, lose, tap, toggle) through debugFeedbackOf, which asks for parts.feedback at call time: the
// test build's recording ports (the E2E feedback evidence), else the real ports.
import { StackActions } from '@react-navigation/native';

import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

import type { DebugParts } from '@e07/shell/app/create-debug-parts.ts';
import type { GameParams } from '@e07/shell/navigation/route-params.ts';
import type { FeedbackPorts } from '@e07/shell/services/audio/ui-feedback.ts';

export type DebugSwitches = {
  /** The board's game.board-layout probe (board-rendering-skia), read while the board draws. */
  readonly isLayoutProbeOn: () => boolean;
  /** The debug link's seed=, read when an endless run starts. */
  readonly seedOverride: () => number | null;
  /** The debug controls' openExample: a new Game screen on top. */
  readonly openGame: (params: GameParams) => void;
};

/** parts() is null until the composition root has created the debug parts. */
export function debugSwitchesOf(parts: () => DebugParts | null): DebugSwitches {
  return {
    isLayoutProbeOn: () =>
      parts()?.services?.isBoardLayoutOn() === true || TEST_ONLY?.isParityBoardProbeOn() === true,
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
