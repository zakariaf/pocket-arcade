// apps/scrap-shove/src/rules/suggest-move.test.ts
import fc from 'fast-check';

import { applyMove } from './apply-move.ts';
import { stateFromText } from './board-text.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { solveFloor } from './solve-floor.ts';
import { HINT_MAX_NODES, suggestMove } from './suggest-move.ts';

import type { ScrapShoveState } from './scrap-shove-types.ts';

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
