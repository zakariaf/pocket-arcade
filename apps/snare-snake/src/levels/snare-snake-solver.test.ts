// apps/snare-snake/src/levels/snare-snake-solver.test.ts
// Spec 8.1 and 15.7: every level that ships is proven winnable. Snare Snake's critters hop from the
// seeded RNG, so a witness (the greedy bot from a fixed bot seed) proves it, replayed by the engine.
import fc from 'fast-check';

import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';
import { applyMove } from '@e07/snare-snake/rules/apply-move.ts';
import { create } from '@e07/snare-snake/rules/create.ts';
import { listMoves } from '@e07/snare-snake/rules/list-moves.ts';
import { outcome } from '@e07/snare-snake/rules/outcome.ts';

import { SNARE_SNAKE_SOLVER, WITNESS_MAX_NODES } from './snare-snake-solver.ts';

import type { SnareSnakeState } from '@e07/snare-snake/rules/snare-snake-types.ts';

const ENGINE = { listMoves, applyMove, outcome };

/** The witness's verdict on a start, replayed through the real engine when it won. */
function replayed(start: SnareSnakeState): unknown {
  const result = SNARE_SNAKE_SOLVER.solve(start, WITNESS_MAX_NODES);
  return result.kind === 'solved' ? verifyLine(ENGINE, start, result.line) : result;
}

/** What the replay must say for that verdict. */
function expectedReplay(start: SnareSnakeState): unknown {
  const result = SNARE_SNAKE_SOLVER.solve(start, WITNESS_MAX_NODES);
  return result.kind === 'solved'
    ? { kind: 'wins', moves: result.par }
    : { kind: 'budget-exceeded' };
}

describe('SNARE_SNAKE_SOLVER', () => {
  it('wins seed 1 at difficulty 0 with a line the engine replays, ending in a won state', () => {
    const start = create(1, 0);
    const result = SNARE_SNAKE_SOLVER.solve(start, WITNESS_MAX_NODES);
    if (result.kind !== 'solved') throw new Error(`expected solved, got ${result.kind}`);
    expect(result.par).toBe(GOLDEN_WITNESS_PAR);
    expect(outcome(result.final)).toStrictEqual({ kind: 'won', score: result.final.score });
    expect(verifyLine(ENGINE, start, result.line)).toStrictEqual({
      kind: 'wins',
      moves: GOLDEN_WITNESS_PAR,
    });
  });

  it('stops at the node budget', () => {
    expect(SNARE_SNAKE_SOLVER.solve(create(1, 0), 5)).toStrictEqual({ kind: 'budget-exceeded' });
  });

  it('reports a lost witness as over budget, never as unsolvable', () => {
    const lost = { ...create(1, 0), moves: 30 };
    expect(SNARE_SNAKE_SOLVER.solve(lost, WITNESS_MAX_NODES)).toStrictEqual({
      kind: 'budget-exceeded',
    });
  });

  it('gives lines that win when replayed through the real engine, deterministically (property)', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const start = create(seed, difficulty);
        expect(replayed(start)).toStrictEqual(expectedReplay(start));
      }),
      { seed: 17, numRuns: 25 },
    );
  });
});

/** Pinned: the witness's winning line for seed 1 at difficulty 0 (a new bot seed changes it). */
const GOLDEN_WITNESS_PAR = 11;
