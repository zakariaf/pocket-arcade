// apps/scrap-shove/src/levels/scrap-shove-solver.test.ts
import fc from 'fast-check';

import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';
import { create } from '@e07/scrap-shove/rules/create.ts';
import { listMoves } from '@e07/scrap-shove/rules/list-moves.ts';
import { outcome } from '@e07/scrap-shove/rules/outcome.ts';

import { SCRAP_SHOVE_SOLVER } from './scrap-shove-solver.ts';

const ENGINE = { listMoves, applyMove, outcome };

describe('SCRAP_SHOVE_SOLVER (spec 8.1: each level is checked by a solver, which calculates par)', () => {
  it('finds the optimal line of a small floor: crush the heavy robot, then step so the others crash', () => {
    const start = stateFromText(['n.n...', '......', '......', '...h..', '...#..', '...@..']);
    const result = SCRAP_SHOVE_SOLVER.solve(start, 10_000);
    expect(result).toMatchObject({ kind: 'solved', par: GOLDEN_SMALL_PAR });
    if (result.kind !== 'solved') throw new Error('solvable floor');
    expect(result.final.robots).toStrictEqual([]);
  });

  it('reports a floor no line can win as unsolvable within its node cap', () => {
    expect(SCRAP_SHOVE_SOLVER.solve(stateFromText(['h..', '...', '..@']), 10_000).kind).toBe(
      'unsolvable',
    );
  });

  it('proves every floor create makes with a line the rules replay to a win in par moves', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 99 }),
        (seed, difficulty) => {
          const start = create(seed, difficulty);
          const result = SCRAP_SHOVE_SOLVER.solve(start, 60_000);
          if (result.kind !== 'solved') throw new Error(`seed ${String(seed)} not solved`);
          expect(verifyLine(ENGINE, start, result.line)).toStrictEqual({
            kind: 'wins',
            moves: result.par,
          });
        },
      ),
      { numRuns: 25 },
    );
  });
});

const GOLDEN_SMALL_PAR = 2;
