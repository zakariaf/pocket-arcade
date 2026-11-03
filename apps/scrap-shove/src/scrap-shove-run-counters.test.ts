// apps/scrap-shove/src/scrap-shove-run-counters.test.ts
// Spec S10 and 8.10: a finished run's statistics count exactly what the player kept. The Shell
// measures the counters by replaying the kept line, its one continue included; Scrap Shove's
// continue puts the floor back as it was before the losing move, so that move's crashes and shoves
// must not count, in the sums nor in "Biggest crash".
import fc from 'fast-check';

import { measureCounters } from '@e07/shell/game-host/measure-counters.ts';

import { scrapShoveGame as game } from './index.ts';

import type {
  ScrapShoveEvent,
  ScrapShoveMove,
  ScrapShoveState,
} from './rules/scrap-shove-types.ts';
import type { RunLogEntry } from '@e07/shell/game-host/game-session-types.ts';

const RULES = { ...game.engine, ...game.rules };

type PlayedRun = {
  readonly log: readonly RunLogEntry<ScrapShoveMove>[];
  /** Each kept move's events: the continue removed the move it took back. */
  readonly kept: readonly (readonly ScrapShoveEvent[])[];
  readonly state: ScrapShoveState;
};

/** Plays the run by its choices, taking the one continue after a loss, until it ends. */
function play(seed: number, difficulty: number, choices: readonly number[]): PlayedRun {
  const log: RunLogEntry<ScrapShoveMove>[] = [];
  const kept: (readonly ScrapShoveEvent[])[] = [];
  let state = game.engine.create(seed, difficulty);
  for (const choice of choices) {
    if (game.engine.outcome(state).kind === 'lost' && !state.hasContinued) {
      if (game.rules.continueRun.kind !== 'once') break;
      state = game.rules.continueRun.apply(state).state;
      log.push({ kind: 'continue' });
      kept.pop();
    }
    const moves = game.engine.listMoves(state);
    const move = moves[choice % Math.max(moves.length, 1)];
    if (move === undefined) break;
    const result = game.engine.applyMove(state, move);
    state = result.state;
    log.push({ kind: 'move', move });
    kept.push(result.events);
  }
  return { log, kept, state };
}

/** What the kept moves did: robots gone from the floor, the player's shoves, the biggest crash. */
function keptCounts(run: PlayedRun): Record<string, number> {
  const [, shoved, biggest] = game.stats.counters;
  return {
    'robots-scrapped': run.state.robotsTotal - run.state.robots.length,
    'scrap-shoved': run.kept.reduce((sum, events) => sum + (shoved?.measure(events) ?? 0), 0),
    'biggest-crash': Math.max(0, ...run.kept.map((events) => biggest?.measure(events) ?? 0)),
  };
}

function measured(seed: number, difficulty: number, run: PlayedRun): Record<string, number> {
  const tally = measureCounters(RULES, { seed, difficulty, log: run.log }, game.stats.counters);
  return Object.fromEntries(Object.entries(tally).map(([id, counter]) => [id, counter.value]));
}

describe('Scrap Shove run counters', () => {
  it('counts exactly what a finished run kept, continue or not', () => {
    let continued = 0;
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 99 }),
        fc.array(fc.nat({ max: 8 }), { minLength: 1, maxLength: 40 }),
        (seed, difficulty, choices) => {
          const run = play(seed, difficulty, choices);
          if (run.log.some((entry) => entry.kind === 'continue')) continued += 1;
          expect(measured(seed, difficulty, run)).toStrictEqual(keptCounts(run));
        },
      ),
      { numRuns: 40 },
    );
    // The property must reach the continue, or it proves nothing about the take-back.
    expect(continued).toBeGreaterThan(0);
  });
});
