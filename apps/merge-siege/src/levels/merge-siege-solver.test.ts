// apps/merge-siege/src/levels/merge-siege-solver.test.ts
// Spec 8.1: "Where the game allows it, each level is checked by a solver before it ships, so no
// level is impossible." Merge Siege draws its future from the RNG, so the proof is a witness: the
// greedy bot wins the level from a fixed bot seed, and its line replays through the real engine.
import fc from 'fast-check';

import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';
import { applyMove } from '@e07/merge-siege/rules/apply-move.ts';
import { parseBoard } from '@e07/merge-siege/rules/board-text.ts';
import { create } from '@e07/merge-siege/rules/create.ts';
import { listMoves } from '@e07/merge-siege/rules/list-moves.ts';
import { outcome } from '@e07/merge-siege/rules/outcome.ts';

import { MERGE_SIEGE_SOLVER, WITNESS_MAX_NODES } from './merge-siege-solver.ts';

const ENGINE = { listMoves, applyMove, outcome };

describe('MERGE_SIEGE_SOLVER', () => {
  it('wins seed 1 at difficulty 0 with a line the engine replays, ending in a won state', () => {
    const start = create(1, 0);
    const result = MERGE_SIEGE_SOLVER.solve(start, WITNESS_MAX_NODES);
    if (result.kind !== 'solved') throw new Error(`expected solved, got ${result.kind}`);
    expect(result.par).toBe(GOLDEN_WITNESS_PAR);
    expect(outcome(result.final)).toStrictEqual({ kind: 'won', score: result.final.score });
    expect(verifyLine(ENGINE, start, result.line)).toStrictEqual({
      kind: 'wins',
      moves: GOLDEN_WITNESS_PAR,
    });
  });

  it('stops at the node budget', () => {
    expect(MERGE_SIEGE_SOLVER.solve(create(1, 0), 3)).toStrictEqual({ kind: 'budget-exceeded' });
  });

  it('reports a lost witness as over budget, never as unsolvable', () => {
    const overrun = {
      ...create(1, 0),
      cells: parseBoard([
        '. . . . .',
        '. . . . .',
        '. . . . .',
        '. . . . .',
        '2 . . . .',
        '. e4 . . .',
      ]),
    };
    expect(MERGE_SIEGE_SOLVER.solve(overrun, WITNESS_MAX_NODES)).toStrictEqual({
      kind: 'budget-exceeded',
    });
  });

  it('gives lines that win when replayed through the real engine, deterministically', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const start = create(seed, difficulty);
        const result = MERGE_SIEGE_SOLVER.solve(start, WITNESS_MAX_NODES);
        expect(MERGE_SIEGE_SOLVER.solve(start, WITNESS_MAX_NODES)).toStrictEqual(result);
        const verdict = result.kind === 'solved' ? verifyLine(ENGINE, start, result.line) : result;
        expect(verdict).toStrictEqual(
          result.kind === 'solved'
            ? { kind: 'wins', moves: result.par }
            : { kind: 'budget-exceeded' },
        );
      }),
      { seed: 17, numRuns: 25 },
    );
  });
});

/** Pinned: the witness's winning line length for seed 1 at difficulty 0 (a new bot seed changes it). */
const GOLDEN_WITNESS_PAR = 8;
