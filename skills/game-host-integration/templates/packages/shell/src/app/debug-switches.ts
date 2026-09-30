// packages/shell/src/app/debug-switches.ts
// The game host's test-build switches, read through the debug parts once createDebugParts made
// them (all off in a store build: no debug services, TEST_ONLY null). The board-layout probe is on
// for the debug link's boardLayout=1 and for a parity probe=board launch, whose capture masks the
// board; the debug controls' openExample pushes the Game route on the debug navigator.
import { StackActions } from '@react-navigation/native';

import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

import type { DebugParts } from '@e07/shell/app/create-debug-parts.ts';
import type { GameParams } from '@e07/shell/navigation/route-params.ts';

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
