// apps/trail-clear/src/levels/trail-clear-solver.test.ts
// Spec 8.1: "each level is checked by a solver before it ships, so no level is impossible".
import fc from 'fast-check';

import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { create } from '@e07/trail-clear/rules/create.ts';
import { listMoves } from '@e07/trail-clear/rules/list-moves.ts';
import { outcome } from '@e07/trail-clear/rules/outcome.ts';
import { knobsFor } from '@e07/trail-clear/rules/trail-clear-tuning.ts';

import { TRAIL_CLEAR_SOLVER, WITNESS_MAX_NODES } from './trail-clear-solver.ts';

import type { SolveResult } from '@e07/game-kit/contract/levels.ts';
import type { TrailClearMove, TrailClearState } from '@e07/trail-clear/rules/trail-clear-types.ts';

const ENGINE = { listMoves, applyMove, outcome };

type Result = SolveResult<TrailClearState, TrailClearMove>;

/** What replaying a witness line through the real engine says, or the witness's own verdict. */
function verdictOf(start: TrailClearState, result: Result): unknown {
  return result.kind === 'solved' ? verifyLine(ENGINE, start, result.line) : result;
}

function expectedVerdict(result: Result): unknown {
  return result.kind === 'solved'
    ? { kind: 'wins', moves: result.par }
    : { kind: 'budget-exceeded' };
}

describe('TRAIL_CLEAR_SOLVER', () => {
  it('wins seed 1 at difficulty 0 with a line the engine replays, the whole bag long', () => {
    const start = create(1, 0);
    const result = TRAIL_CLEAR_SOLVER.solve(start, WITNESS_MAX_NODES);
    if (result.kind !== 'solved') throw new Error(`expected solved, got ${result.kind}`);
    expect(result.par).toBe(knobsFor(0).bag);
    expect(result.final.score).toBe(GOLDEN_WITNESS_SCORE);
    expect(outcome(result.final)).toStrictEqual({ kind: 'won', score: result.final.score });
    expect(verifyLine(ENGINE, start, result.line)).toStrictEqual({
      kind: 'wins',
      moves: knobsFor(0).bag,
    });
  });

  it('stops at the node budget', () => {
    expect(TRAIL_CLEAR_SOLVER.solve(create(1, 0), 10)).toStrictEqual({ kind: 'budget-exceeded' });
  });

  it('reports a lost witness as over budget, never as unsolvable', () => {
    const full = create(1, 0).cells.map(() => ({
      kind: 'river-end' as const,
      turns: 0,
      placedAt: 1,
    }));
    const lost = { ...create(1, 0), cells: full };
    expect(TRAIL_CLEAR_SOLVER.solve(lost, WITNESS_MAX_NODES)).toStrictEqual({
      kind: 'budget-exceeded',
    });
  });

  it('gives lines that win when replayed through the real engine, deterministically', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const start = create(seed, difficulty);
        const result = TRAIL_CLEAR_SOLVER.solve(start, WITNESS_MAX_NODES);
        expect(TRAIL_CLEAR_SOLVER.solve(start, WITNESS_MAX_NODES)).toStrictEqual(result);
        expect(verdictOf(start, result)).toStrictEqual(expectedVerdict(result));
      }),
      { seed: 17, numRuns: 12 },
    );
  });
});

/** Pinned: the witness's final score for seed 1 at difficulty 0 (a new bot seed changes it). */
const GOLDEN_WITNESS_SCORE = 790;
