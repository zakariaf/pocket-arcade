// packages/shell/src/game-host/game-debug-controls.ts
// The game host's test-build entry points: the E2E debug link ends the current level
// (action=win-level|lose-level: playTo) or opens one of the game's example states (screen=game-start,
// game-middle, result-win, result-lose: openExample), and the parity harness shows the design's
// numbers on the game frames (applyFixtureHud, showFixtureResult). Only createDebugParts receives
// them, and it gets null parts in a store build, so no player can reach them.
import { fixtureHudViewOf, fixtureResultViewOf } from '@e07/shell/game-host/game-fixture.ts';

import type { ExampleStateId } from '@e07/game-kit/contract/testing.ts';
import type { DebugGameControls, DebugGameExample } from '@e07/shell/app/debug-link-routes.ts';
import type { FixtureResult, GameFixture } from '@e07/shell/game-host/game-fixture.ts';
import type { SessionController } from '@e07/shell/game-host/session-controller.ts';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { GameParams } from '@e07/shell/navigation/route-params.ts';

export type GameDebugControls = Omit<DebugGameControls, 'playTo'> & {
  /**
   * The active run jumps to the game's testing.examples.win() or lose() and ends through the
   * host's one run-end path (stars, statistics, the ad history), saved before Result shows.
   * False when no run is open (nothing changes; the debug link reports the error).
   */
  readonly playTo: (outcome: FixtureResult) => boolean;
  /** S5 and S6 frames: the fixture's level, score and progress in the top bar. */
  readonly applyFixtureHud: (fixture: GameFixture) => void;
  /** S7 frames: the Result for the fixture's win or loss, built without writing the save. */
  readonly showFixtureResult: (fixture: GameFixture, result: FixtureResult) => void;
};

type Controller<T extends ShellGameTypes> = SessionController<T['state'], T['move'], T['event']>;

/** The example an openExample call stages for the next level-1 run, and how that run ends. */
export type StagedExample<T extends ShellGameTypes> = {
  readonly state: T['state'];
  readonly endsAs: FixtureResult | null;
};

/** The host's record of its runs (game-host.ts keeps it in its closure). */
export type DebugRuns<T extends ShellGameTypes> = {
  /** The last opened run that is not the tutorial and was not left for Home; null otherwise. */
  readonly active: () => Controller<T> | null;
  readonly stage: (example: StagedExample<T>) => void;
};

/** The route openExample opens: a new run of level 1 (it takes the staged example state). */
export const EXAMPLE_RUN: GameParams = { start: 'new', ref: { kind: 'level', level: 1 } };

const EXAMPLES: Readonly<
  Record<DebugGameExample, readonly [ExampleStateId, FixtureResult | null]>
> = {
  'game-start': ['start', null],
  'game-middle': ['middle', null],
  'result-win': ['start', 'won'],
  'result-lose': ['start', 'lost'],
};

export type DebugControlsInput<T extends ShellGameTypes> = {
  readonly game: ShellGameModule<T>;
  readonly runs: DebugRuns<T>;
  /** Test builds: pushes the Game route on the app's navigator; absent in unit tests. */
  readonly openGame?: (params: GameParams) => void;
};

/** The example's final state: the game's own win or lose example. */
export function endStateOf<T extends ShellGameTypes>(
  game: ShellGameModule<T>,
  result: FixtureResult,
): T['state'] {
  return result === 'won' ? game.testing.examples.win() : game.testing.examples.lose();
}

export function createGameDebugControls<T extends ShellGameTypes>(
  input: DebugControlsInput<T>,
): GameDebugControls {
  const { game, runs } = input;
  return {
    playTo: (outcome) => runs.active()?.endWith(endStateOf(game, outcome)) ?? false,
    openExample: (example) => {
      const [stateId, endsAs] = EXAMPLES[example];
      runs.stage({ state: game.testing.examples[stateId](), endsAs });
      input.openGame?.(EXAMPLE_RUN);
    },
    applyFixtureHud: (fixture) => {
      const controller = runs.active();
      controller?.showFixture(fixtureHudViewOf(controller.handle.getView(), fixture));
    },
    showFixtureResult: (fixture, result) => {
      const controller = runs.active();
      controller?.showFixture(fixtureResultViewOf(controller.handle.getView(), fixture, result));
    },
  };
}
