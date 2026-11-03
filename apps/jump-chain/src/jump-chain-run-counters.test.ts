// apps/jump-chain/src/jump-chain-run-counters.test.ts
// Spec S10 and 8.10: a finished run's statistics count exactly what the player kept. The Shell
// measures the counters by replaying the kept line, its one continue included. Jump Chain's
// continue takes no move back: it steps the enemy ranks back and every capture stays, so every
// move counts and the continue declares no take-back.
import fc from 'fast-check';

import { measureCounters } from '@e07/shell/game-host/measure-counters.ts';

import { jumpChainGame as game } from './index.ts';

import type { JumpChainMove, JumpChainState } from './rules/jump-chain-types.ts';
import type { RunLogEntry } from '@e07/shell/game-host/game-session-types.ts';

const RULES = { ...game.engine, ...game.rules };

type PlayedRun = {
  readonly log: readonly RunLogEntry<JumpChainMove>[];
  readonly longestChain: number;
  readonly state: JumpChainState;
};

/** Plays the run by its choices, taking the one continue after a loss, until it ends. */
function play(seed: number, difficulty: number, choices: readonly number[]): PlayedRun {
  const log: RunLogEntry<JumpChainMove>[] = [];
  let state = game.engine.create(seed, difficulty);
  let longestChain = 0;
  for (const choice of choices) {
    if (game.engine.outcome(state).kind === 'lost' && !state.hasContinued) {
      if (game.rules.continueRun.kind !== 'once') break;
      state = game.rules.continueRun.apply(state).state;
      log.push({ kind: 'continue' });
    }
    const moves = game.engine.listMoves(state);
    const move = moves[choice % Math.max(moves.length, 1)];
    if (move === undefined) break;
    if (move.kind === 'jump') longestChain = Math.max(longestChain, move.path.length);
    state = game.engine.applyMove(state, move).state;
    log.push({ kind: 'move', move });
  }
  return { log, longestChain, state };
}

function measured(seed: number, difficulty: number, run: PlayedRun): Record<string, number> {
  const tally = measureCounters(RULES, { seed, difficulty, log: run.log }, game.stats.counters);
  return Object.fromEntries(Object.entries(tally).map(([id, counter]) => [id, counter.value]));
}

describe('Jump Chain run counters', () => {
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
        fc.array(fc.nat({ max: 7 }), { minLength: 1, maxLength: 120 }),
        (seed, difficulty, choices) => {
          const run = play(seed, difficulty, choices);
          if (run.log.some((entry) => entry.kind === 'continue')) continued += 1;
          expect(measured(seed, difficulty, run)).toStrictEqual({
            'pieces-captured': run.state.captured,
            'longest-chain': run.longestChain,
            'ranks-cleared': run.state.ranksCleared,
          });
        },
      ),
      { numRuns: 40 },
    );
    // The property must reach the continue, or it proves nothing about it.
    expect(continued).toBeGreaterThan(0);
  });
});
