// apps/toggle-drop/src/levels/toggle-drop-solver.test.ts
import fc from 'fast-check';

import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';
import { dropPath } from '@e07/toggle-drop/rules/drop-path.ts';
import { listMoves } from '@e07/toggle-drop/rules/list-moves.ts';
import { outcome } from '@e07/toggle-drop/rules/outcome.ts';
import { knobsFor } from '@e07/toggle-drop/rules/toggle-drop-tuning.ts';

import { HINT_MAX_NODES, TOGGLE_DROP_SOLVER, suggestDrop } from './toggle-drop-solver.ts';

import type * as ApplyMoveRules from '@e07/toggle-drop/rules/apply-move.ts';
import type * as DropPathRules from '@e07/toggle-drop/rules/drop-path.ts';
import type { ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

// Counting wrappers around the real rules: the hint's cost is the falls its search plays.
jest.mock('@e07/toggle-drop/rules/apply-move.ts', () => {
  const actual: typeof ApplyMoveRules = jest.requireActual('@e07/toggle-drop/rules/apply-move.ts');
  return { applyMove: jest.fn(actual.applyMove) };
});
jest.mock('@e07/toggle-drop/rules/drop-path.ts', () => {
  const actual: typeof DropPathRules = jest.requireActual('@e07/toggle-drop/rules/drop-path.ts');
  return { ...actual, dropPath: jest.fn(actual.dropPath) };
});

const ENGINE = { listMoves, applyMove, outcome };

/** Row 0: a right switch in the middle; row 1: left switches at both ends; cups under 0 and 1. */
function board(overrides: Partial<ToggleDropState> = {}): ToggleDropState {
  return {
    cols: 3,
    rows: 2,
    pegs: [-1, 1, -1, 0, -1, 0],
    flips: [0, 0, 0, 0, 0, 0],
    needs: [1, 1, 0],
    filled: [0, 0, 0],
    ballsLeft: 3,
    drops: 0,
    ...overrides,
  };
}

describe('TOGGLE_DROP_SOLVER', () => {
  // Spec 8.1: "each level is checked by a solver before it ships ... and the solver also calculates
  // 'par' (the best possible result)".
  it('finds the shortest line of a small board and the state it ends in', () => {
    const start = board();
    const result = TOGGLE_DROP_SOLVER.solve(start, 1000);
    expect(result).toStrictEqual({
      kind: 'solved',
      par: 2,
      line: [
        { kind: 'drop', col: 0 },
        { kind: 'drop', col: 0 },
      ],
      final: applyMove(applyMove(start, { kind: 'drop', col: 0 }).state, { kind: 'drop', col: 0 })
        .state,
    });
  });

  it('reports a board no line can win as unsolvable', () => {
    expect(TOGGLE_DROP_SOLVER.solve(board({ needs: [2, 0, 0], ballsLeft: 1 }), 1000)).toStrictEqual(
      { kind: 'unsolvable' },
    );
  });

  it('stops at the node budget', () => {
    expect(TOGGLE_DROP_SOLVER.solve(create(3, 80), 2)).toStrictEqual({ kind: 'budget-exceeded' });
  });

  it('solves every generated board within its winning line, with a line the engine accepts', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const start = create(seed, difficulty);
        const result = TOGGLE_DROP_SOLVER.solve(start, 60_000);
        if (result.kind !== 'solved') throw new Error(`not solved: ${result.kind}`);
        expect(result.par).toBeLessThanOrEqual(knobsFor(difficulty).witnessDrops);
        expect(verifyLine(ENGINE, start, result.line)).toStrictEqual({
          kind: 'wins',
          moves: result.par,
        });
      }),
      { seed: 17, numRuns: 60 },
    );
  });
});

describe('suggestDrop (rules.hints: solver)', () => {
  // Spec 8.5: "The game's solver suggests the next good move, and the Shell highlights it."
  it('suggests the first drop of a shortest line', () => {
    expect(suggestDrop(board())).toStrictEqual({ kind: 'drop', col: 0 });
  });

  it('keeps the level winnable along the solver line, one ball shorter each time', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const start = create(seed, difficulty);
        const first = TOGGLE_DROP_SOLVER.solve(start, HINT_MAX_NODES);
        if (first.kind !== 'solved') throw new Error(`not solved: ${first.kind}`);
        const hint = suggestDrop(start);
        if (hint === null) throw new Error('no hint on a playing board');
        expect(listMoves(start)).toContainEqual(hint);
        const after = TOGGLE_DROP_SOLVER.solve(applyMove(start, hint).state, HINT_MAX_NODES);
        expect(after.kind === 'solved' ? after.par : -1).toBe(first.par - 1);
      }),
      { seed: 5, numRuns: 40 },
    );
  });

  it('suggests the first drop of a fresh solve from a board off the line', () => {
    const offLine = applyMove(board(), { kind: 'drop', col: 2 }).state;
    const fresh = TOGGLE_DROP_SOLVER.solve(offLine, HINT_MAX_NODES);
    expect(fresh.kind).toBe('solved');
    expect(suggestDrop(offLine)).toStrictEqual(fresh.kind === 'solved' ? fresh.line[0] : null);
  });

  it('suggests nothing on a won or a lost board', () => {
    expect(suggestDrop(board({ filled: [1, 1, 0] }))).toBeNull();
    expect(suggestDrop(board({ ballsLeft: 0 }))).toBeNull();
  });
});

describe('suggestDrop on a phone', () => {
  /** A 9 x 9 board full of switches, twenty balls and a cup no line can fill: the search never ends. */
  const HUGE: ToggleDropState = {
    cols: 9,
    rows: 9,
    pegs: Array.from({ length: 81 }, (_, index) => (index % 3 === 0 ? 1 : 0)),
    flips: Array.from({ length: 81 }, () => 0),
    needs: [0, 0, 0, 0, 30, 0, 0, 0, 0],
    filled: Array.from({ length: 9 }, () => 0),
    ballsLeft: 20,
    drops: 0,
  };

  beforeEach(() => {
    jest.mocked(applyMove).mockClear();
    jest.mocked(dropPath).mockClear();
  });

  // Spec 8.5: a hint answers at once. Measured over every shipped level and 30 dailies, the
  // searches needed at most 1,000 positions; the budget stops a far bigger board within 20,000 falls.
  it('gives up within a small search on a board far beyond any level', () => {
    expect(suggestDrop(HUGE)).toBeNull();
    expect(jest.mocked(dropPath).mock.calls.length).toBeLessThanOrEqual(20_000);
  });

  it('suggests a drop without replaying the line through the rules', () => {
    expect(suggestDrop(board())).toStrictEqual({ kind: 'drop', col: 0 });
    expect(jest.mocked(applyMove)).not.toHaveBeenCalled();
  });
});
