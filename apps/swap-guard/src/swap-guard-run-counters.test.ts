// apps/swap-guard/src/swap-guard-run-counters.test.ts
// Spec S10 and 8.10: a finished run's statistics count exactly what the player kept. The Shell
// measures the counters by replaying the kept line, its one continue included; Swap Guard's
// continue takes the losing swap back, so that swap, its knock-outs and its double hit must not
// count, and nothing may be taken back twice.
import fc from 'fast-check';

import { measureCounters } from '@e07/shell/game-host/measure-counters.ts';

import { swapGuardGame as game } from './index.ts';

import type { SwapGuardEvent, SwapGuardMove, SwapGuardState } from './rules/swap-guard-types.ts';
import type { RunLogEntry } from '@e07/shell/game-host/game-session-types.ts';

const RULES = { ...game.engine, ...game.rules };

type Rules = typeof RULES;

type PlayedRun = {
  readonly log: readonly RunLogEntry<SwapGuardMove>[];
  /** Each kept move's events: the continue removed the swap it took back. */
  readonly kept: readonly (readonly SwapGuardEvent[])[];
  readonly state: SwapGuardState;
};

/** Plays the run by its choices, taking the one continue after a loss, until it ends. */
function play(seed: number, difficulty: number, choices: readonly number[]): PlayedRun {
  const log: RunLogEntry<SwapGuardMove>[] = [];
  const kept: (readonly SwapGuardEvent[])[] = [];
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
    log.push({ kind: 'move', move });
    kept.push(result.events);
    state = result.state;
  }
  return { log, kept, state };
}

/** The counts of the kept line: enemies off the board, swaps on the counter, two-down volleys. */
function keptCounts(run: PlayedRun): Record<string, number> {
  const volleys = run.kept
    .flat()
    .flatMap((event) => (event.kind === 'enemies-defeated' ? [event.enemyIds.length] : []));
  return {
    'enemies-defeated': run.state.enemyCount - run.state.enemies.length,
    'swaps-made': run.state.swaps,
    'double-hits': volleys.filter((count) => count >= 2).length,
  };
}

function measured(
  rules: Rules,
  run: { readonly seed: number; readonly difficulty: number; readonly log: PlayedRun['log'] },
): Record<string, number> {
  const tally = measureCounters(rules, run, game.stats.counters);
  return Object.fromEntries(Object.entries(tally).map(([id, counter]) => [id, counter.value]));
}

/**
 * 5 x 5, the guard on 12. The spear on 11 strikes 12 and the spear on 6 strikes 11; the spear on 8
 * strikes the spear on 13. A swap with the spear on 11 knocks out two spears and is hit.
 */
const DOUBLE_THEN_HIT: SwapGuardState = {
  size: 5,
  guard: 12,
  enemies: [
    { id: 0, kind: 'spear', facing: 'right', cell: 11 },
    { id: 1, kind: 'spear', facing: 'down', cell: 6 },
    { id: 2, kind: 'spear', facing: 'down', cell: 8 },
    { id: 3, kind: 'spear', facing: 'right', cell: 13 },
  ],
  enemyCount: 4,
  swaps: 0,
  maxSwaps: 12,
  score: 0,
  isHit: false,
  lastSwap: null,
  hasContinued: false,
};

describe('Swap Guard run counters', () => {
  it('counts nothing of a double knock-out the continue took back, and takes nothing back twice', () => {
    const rules = { ...RULES, create: () => DOUBLE_THEN_HIT };
    const swap = { kind: 'move', move: { kind: 'swap', cell: 11 } } as const;
    const lost = game.engine.applyMove(DOUBLE_THEN_HIT, swap.move).state;
    expect(game.engine.outcome(lost).kind).toBe('lost');
    expect(measured(rules, { seed: 0, difficulty: 0, log: [swap] })).toStrictEqual({
      'enemies-defeated': 2,
      'swaps-made': 1,
      'double-hits': 1,
    });
    expect(
      measured(rules, { seed: 0, difficulty: 0, log: [swap, { kind: 'continue' }] }),
    ).toStrictEqual({ 'enemies-defeated': 0, 'swaps-made': 0, 'double-hits': 0 });
  });

  it('counts no swap the continue took back (a pinned continued run with a double hit)', () => {
    const choices = Array.from({ length: 60 }, (_, index) => (index * 7) % 4);
    const run = play(3, 10, choices);
    expect(run.log.some((entry) => entry.kind === 'continue')).toBe(true);
    expect(keptCounts(run)['double-hits']).toBeGreaterThan(0);
    expect(measured(RULES, { seed: 3, difficulty: 10, log: run.log })).toStrictEqual(
      keptCounts(run),
    );
  });

  it('counts exactly what a finished run kept, continue or not', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 99 }),
        fc.array(fc.nat({ max: 3 }), { minLength: 1, maxLength: 80 }),
        (seed, difficulty, choices) => {
          const run = play(seed, difficulty, choices);
          expect(measured(RULES, { seed, difficulty, log: run.log })).toStrictEqual(
            keptCounts(run),
          );
        },
      ),
      { numRuns: 25 },
    );
  });
});
