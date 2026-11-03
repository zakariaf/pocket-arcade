// apps/scrap-shove/src/rules/suggest-move.test.ts
import fc from 'fast-check';

import { advanceFloor, applyMove } from './apply-move.ts';
import { stateFromText } from './board-text.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { solveFloor } from './solve-floor.ts';
import { HINT_MAX_NODES, suggestMove } from './suggest-move.ts';

import type * as ApplyMoveRules from './apply-move.ts';
import type { ScrapShoveState } from './scrap-shove-types.ts';

// A counting wrapper around the real search apply: a hint's cost is the positions it plays.
jest.mock('./apply-move.ts', () => {
  const actual: typeof ApplyMoveRules = jest.requireActual('./apply-move.ts');
  return { ...actual, advanceFloor: jest.fn(actual.advanceFloor) };
});

/** Most moves a position offers: eight neighbours and the wait. */
const MAX_MOVES = 9;

/** The states a player passes when they follow every hint from the start. */
function followHints(start: ScrapShoveState): ScrapShoveState[] {
  const states = [start];
  let state = start;
  for (let move = suggestMove(state); move !== null; move = suggestMove(state)) {
    state = applyMove(state, move).state;
    states.push(state);
  }
  return states;
}

describe('suggestMove (spec 8.5: the solver suggests the next good move)', () => {
  it('suggests the shove that crushes the last heavy robot', () => {
    const state = stateFromText(['.....', '.....', '..h..', '...#.', '....@']);
    expect(suggestMove(state)).toStrictEqual({ kind: 'shove', col: 3, row: 3 });
  });

  it('gives the first move of the solver line on the start of a floor', () => {
    const start = create(1, 0);
    const result = solveFloor(start, HINT_MAX_NODES);
    if (result.kind !== 'solved') throw new Error('seed 1 is solvable');
    expect(suggestMove(start)).toStrictEqual(result.line[0]);
  });

  it('gives no hint on a won, a lost or a floor that cannot be won any more', () => {
    const lineUp = stateFromText(['.....', '.....', '..h..', '...#.', '....@']);
    const won = applyMove(lineUp, { kind: 'shove', col: 3, row: 3 }).state;
    expect(suggestMove(won)).toBeNull();
    expect(suggestMove({ ...lineUp, caughtBy: 1 })).toBeNull();
    expect(suggestMove(stateFromText(['...', '.n.', '..@']))).toBeNull();
  });

  it('leads a player who follows every hint to a win in par moves', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 99 }),
        (seed, difficulty) => {
          const start = create(seed, difficulty);
          const result = solveFloor(start, HINT_MAX_NODES);
          const states = followHints(start);
          expect(states.at(-1)?.robots).toStrictEqual([]);
          expect(states).toHaveLength(result.kind === 'solved' ? result.par + 1 : 0);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('suggests a legal move that keeps the floor winnable after an off-line move', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), fc.nat(), (seed, pick) => {
        const start = create(seed, 0);
        const moves = listMoves(start);
        const off = applyMove(start, moves[pick % moves.length] ?? { kind: 'wait' }).state;
        const hint = suggestMove(off);
        fc.pre(hint !== null);
        expect(listMoves(off)).toContainEqual(hint);
        expect(solveFloor(applyMove(off, hint).state, HINT_MAX_NODES).kind).toBe('solved');
      }),
      { numRuns: 20 },
    );
  });
});

describe('suggestMove on a phone', () => {
  /** A 16 x 16 floor, four heavy robots in the corners: its win lies past 5,000 positions. */
  const HUGE = stateFromText(
    Array.from({ length: 16 }, (_, row) => {
      if (row === 0 || row === 15) return 'h..............h';
      if (row === 6 || row === 8) return '......#.#.......';
      return row === 7 ? '.......@........' : '................';
    }),
  );

  // Spec 8.5: a hint answers at once. Measured over every shipped level and 30 dailies, a hint
  // needs at most 1,507 positions; a floor far beyond any level stops at the cap instead.
  it('gives up within the hint budget on a floor far beyond any level', () => {
    jest.mocked(advanceFloor).mockClear();
    expect(suggestMove(HUGE)).toBeNull();
    expect(jest.mocked(advanceFloor).mock.calls.length).toBeLessThanOrEqual(5_000 * MAX_MOVES);
  });
});

describe('suggestMove while the player follows its hints', () => {
  /** The first move of a fresh search from this position (null when it finds no win). */
  function searched(state: ScrapShoveState): unknown {
    const result = solveFloor(state, HINT_MAX_NODES);
    return result.kind === 'solved' ? (result.line[0] ?? null) : null;
  }

  it('answers the next hint from the line it found, without a new search', () => {
    const start = create(356_075_057, 0);
    const first = suggestMove(start);
    if (first === null) throw new Error('level 1 is solvable');
    const next = applyMove(start, first).state;
    jest.mocked(advanceFloor).mockClear();
    const second = suggestMove(next);
    expect(jest.mocked(advanceFloor)).not.toHaveBeenCalled();
    expect(second).toStrictEqual(searched(next));
  });

  it('gives the move a fresh search gives, on the line it found and off it', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), fc.nat(), (seed, pick) => {
        const states = followHints(create(seed, 30));
        const second = states[1];
        const offMoves = second === undefined ? [] : listMoves(second);
        const offMove = offMoves[pick % Math.max(offMoves.length, 1)];
        const off =
          second === undefined || offMove === undefined ? [] : [applyMove(second, offMove).state];
        for (const state of [...states, ...off]) {
          expect(suggestMove(state)).toStrictEqual(searched(state));
        }
      }),
      { numRuns: 20 },
    );
  });
});
