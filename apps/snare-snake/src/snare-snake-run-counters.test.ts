// apps/snare-snake/src/snare-snake-run-counters.test.ts
// Spec S10 and 8.10: a finished run's statistics count exactly what the player kept. The Shell
// measures the counters by replaying the kept line, its one continue included. Snare Snake's
// continue takes no move back: the critters caught and the loops closed stay, and a boxed-in snake
// only gives up its head cell, so every move counts and the continue declares no take-back.
import fc from 'fast-check';

import { measureCounters } from '@e07/shell/game-host/measure-counters.ts';

import { snareSnakeGame as game } from './index.ts';

import type { SnareSnakeMove, SnareSnakeState } from './rules/snare-snake-types.ts';
import type { RunLogEntry } from '@e07/shell/game-host/game-session-types.ts';

const RULES = { ...game.engine, ...game.rules };

type PlayedRun = {
  readonly log: readonly RunLogEntry<SnareSnakeMove>[];
  readonly loops: number;
  readonly longest: number;
  readonly state: SnareSnakeState;
};

/** Plays the run by its choices, taking the one continue after a loss, until it ends. */
function play(seed: number, difficulty: number, choices: readonly number[]): PlayedRun {
  const log: RunLogEntry<SnareSnakeMove>[] = [];
  let state = game.engine.create(seed, difficulty);
  let loops = 0;
  let longest = 0;
  for (const choice of choices) {
    if (game.engine.outcome(state).kind === 'lost' && !state.hasContinued) {
      if (game.rules.continueRun.kind !== 'once') break;
      state = game.rules.continueRun.apply(state).state;
      log.push({ kind: 'continue' });
    }
    const moves = game.engine.listMoves(state);
    const move = moves[choice % Math.max(moves.length, 1)];
    if (move === undefined) break;
    const result = game.engine.applyMove(state, move);
    loops += result.events.filter((event) => event.kind === 'loop-closed').length;
    state = result.state;
    longest = Math.max(longest, state.snake.length);
    log.push({ kind: 'move', move });
  }
  return { log, loops, longest, state };
}

function measured(seed: number, difficulty: number, run: PlayedRun): Record<string, number> {
  const tally = measureCounters(RULES, { seed, difficulty, log: run.log }, game.stats.counters);
  return Object.fromEntries(Object.entries(tally).map(([id, counter]) => [id, counter.value]));
}

describe('Snare Snake run counters', () => {
  it('declares a continue that keeps every move', () => {
    expect(game.rules.continueRun).toMatchObject({ kind: 'once' });
    expect(game.rules.continueRun).not.toHaveProperty('isTakeBack');
  });

  it('counts exactly what a finished run kept, continue or not', () => {
    let continued = 0;
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 99 }),
        fc.array(fc.nat({ max: 3 }), { minLength: 40, maxLength: 120 }),
        (seed, difficulty, choices) => {
          const run = play(seed, difficulty, choices);
          if (run.log.some((entry) => entry.kind === 'continue')) continued += 1;
          expect(measured(seed, difficulty, run)).toStrictEqual({
            'critters-caught': run.state.caught,
            'loops-closed': run.loops,
            'longest-snake': run.longest,
          });
        },
      ),
      { numRuns: 40 },
    );
    // The property must reach the continue, or it proves nothing about it.
    expect(continued).toBeGreaterThan(0);
  });
});
