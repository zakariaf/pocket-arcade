// apps/flock-tilt/src/flock-tilt-run-counters.test.ts
// Spec S10 and 8.10: a finished run's statistics count exactly what the player kept. The Shell
// measures the counters by replaying the kept line, its one continue included; Flock Tilt's
// continue takes the losing tilt back, so that tilt (and a sheep it penned) must not count.
import fc from 'fast-check';

import { measureCounters } from '@e07/shell/game-host/measure-counters.ts';

import { flockTiltGame as game } from './index.ts';

import type { FlockTiltMove, FlockTiltState } from './rules/flock-tilt-types.ts';
import type { RunLogEntry } from '@e07/shell/game-host/game-session-types.ts';

const RULES = { ...game.engine, ...game.rules };

type PlayedRun = {
  readonly log: readonly RunLogEntry<FlockTiltMove>[];
  readonly state: FlockTiltState;
};

/** Plays the run by its choices, taking the one continue after a loss, until it ends. */
function play(seed: number, difficulty: number, choices: readonly number[]): PlayedRun {
  const log: RunLogEntry<FlockTiltMove>[] = [];
  let state = game.engine.create(seed, difficulty);
  for (const choice of choices) {
    const result = game.engine.outcome(state);
    if (result.kind === 'lost' && !state.hasContinued) {
      state =
        game.rules.continueRun.kind === 'once' ? game.rules.continueRun.apply(state).state : state;
      log.push({ kind: 'continue' });
    }
    const moves = game.engine.listMoves(state);
    const move = moves[choice % Math.max(moves.length, 1)];
    if (move === undefined) break;
    state = game.engine.applyMove(state, move).state;
    log.push({ kind: 'move', move });
  }
  return { log, state };
}

/** The counts the final board shows: penned sheep, tilts kept, a field cleared at par. */
function keptCounts(state: FlockTiltState): Record<string, number> {
  const isWon = game.engine.outcome(state).kind === 'won';
  return {
    'sheep-penned': state.sheep.filter((sheep) => sheep.status === 'penned').length,
    'tilts-made': state.tilts,
    'solved-at-par': isWon && state.tilts <= state.par ? 1 : 0,
  };
}

function measured(seed: number, difficulty: number, run: PlayedRun): Record<string, number> {
  const tally = measureCounters(RULES, { seed, difficulty, log: run.log }, game.stats.counters);
  return Object.fromEntries(Object.entries(tally).map(([id, counter]) => [id, counter.value]));
}

describe('Flock Tilt run counters', () => {
  it('counts no tilt the continue took back (a pinned continued run)', () => {
    const choices = Array.from({ length: 60 }, (_, index) => (index * 7) % 4);
    const run = play(11, 30, choices);
    expect(run.log.some((entry) => entry.kind === 'continue')).toBe(true);
    expect(measured(11, 30, run)).toStrictEqual(keptCounts(run.state));
  });

  it('counts exactly what a finished run kept, continue or not', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 99 }),
        fc.array(fc.nat({ max: 3 }), { minLength: 1, maxLength: 80 }),
        (seed, difficulty, choices) => {
          const run = play(seed, difficulty, choices);
          expect(measured(seed, difficulty, run)).toStrictEqual(keptCounts(run.state));
        },
      ),
      { numRuns: 25 },
    );
  });
});
