// apps/line-siege/src/levels/line-siege-solver.test.ts
import fc from 'fast-check';

import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { create } from '@e07/line-siege/rules/create.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';
import { outcome } from '@e07/line-siege/rules/outcome.ts';

import { LINE_SIEGE_SOLVER, WITNESS_MAX_NODES } from './line-siege-solver.ts';

const ENGINE = { listMoves, applyMove, outcome };

describe('LINE_SIEGE_SOLVER', () => {
  it('wins seed 1 at difficulty 0 with a line the engine replays, ending in a won state', () => {
    const start = create(1, 0);
    const result = LINE_SIEGE_SOLVER.solve(start, WITNESS_MAX_NODES);
    if (result.kind !== 'solved') throw new Error(`expected solved, got ${result.kind}`);
    expect(result.par).toBe(GOLDEN_WITNESS_PAR);
    expect(outcome(result.final)).toStrictEqual({ kind: 'won', score: result.final.score });
    expect(verifyLine(ENGINE, start, result.line)).toStrictEqual({ kind: 'wins', moves: 25 });
  });

  it('stops at the node budget', () => {
    expect(LINE_SIEGE_SOLVER.solve(create(1, 0), 10)).toStrictEqual({ kind: 'budget-exceeded' });
  });

  it('reports a lost witness as over budget, never as unsolvable', () => {
    const lost = { ...create(1, 0), hearts: 0 };
    expect(LINE_SIEGE_SOLVER.solve(lost, WITNESS_MAX_NODES)).toStrictEqual({
      kind: 'budget-exceeded',
    });
  });

  it('gives lines that win when replayed through the real engine, deterministically', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const start = create(seed, difficulty);
        const result = LINE_SIEGE_SOLVER.solve(start, WITNESS_MAX_NODES);
        expect(LINE_SIEGE_SOLVER.solve(start, WITNESS_MAX_NODES)).toStrictEqual(result);
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

/** Pinned: the witness's winning line for seed 1 at difficulty 0 (a new bot seed changes it). */
const GOLDEN_WITNESS_PAR = 25;
