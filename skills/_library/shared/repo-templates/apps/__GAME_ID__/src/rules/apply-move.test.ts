// apps/__GAME_ID__/src/rules/apply-move.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';

import type { Cell, __GAME_PASCAL__State } from './__GAME_ID__-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 40 });

/** A 3x3 board with exactly these cells lit. */
function board(lit: readonly number[]): __GAME_PASCAL__State {
  const cells = Array.from({ length: 9 }, (_, index): Cell => (lit.includes(index) ? 1 : 0));
  return { cols: 3, rows: 3, cells, moves: 0, maxMoves: 6 };
}

function expectInvariants(states: readonly __GAME_PASCAL__State[]): void {
  states.forEach((state, index) => {
    expect(state.moves).toBe(index + (states[0]?.moves ?? 0));
    expect(state.moves).toBeLessThanOrEqual(state.maxMoves);
    expect(state.cells).toHaveLength(state.cols * state.rows);
  });
}

describe('applyMove', () => {
  it('flips the tapped cell and its orthogonal neighbours', () => {
    const { state, events } = applyMove(board([8]), { kind: 'flip', col: 1, row: 1 });
    expect(state.cells).toStrictEqual([0, 1, 0, 1, 1, 1, 0, 1, 1]);
    expect(state.moves).toBe(1);
    expect(events).toStrictEqual([{ kind: 'cells-flipped', cells: [1, 3, 4, 5, 7] }]);
  });

  it('flips only the neighbours that exist at a corner', () => {
    const { events } = applyMove(board([8]), { kind: 'flip', col: 0, row: 0 });
    expect(events).toStrictEqual([{ kind: 'cells-flipped', cells: [0, 1, 3] }]);
  });

  describe('when the flip darkens the last lit cells', () => {
    it('emits board-cleared after cells-flipped', () => {
      const { events } = applyMove(board([0, 1, 3]), { kind: 'flip', col: 0, row: 0 });
      expect(events).toStrictEqual([
        { kind: 'cells-flipped', cells: [0, 1, 3] },
        { kind: 'board-cleared' },
      ]);
    });
  });

  describe('when the move is illegal', () => {
    it('throws for a cell outside the grid', () => {
      expect(() => applyMove(board([4]), { kind: 'flip', col: 3, row: 0 })).toThrow(RangeError);
    });

    it('throws once the game is over', () => {
      const spent = { ...board([4]), moves: 6 };
      expect(() => applyMove(spent, { kind: 'flip', col: 1, row: 1 })).toThrow(RangeError);
    });
  });

  describe('properties', () => {
    it('replays identically for the same seed, difficulty and move choices', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const first = playChoices(RULES, create(seed, difficulty), choices);
          expect(playChoices(RULES, create(seed, difficulty), choices)).toStrictEqual(first);
        }),
      );
    });

    it('counts one move per flip and never passes the move limit', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          expectInvariants(playChoices(RULES, create(seed, difficulty), choices).states);
        }),
        { numRuns: 200 },
      );
    });

    it('undoes a flip when the same cell is flipped twice', () => {
      fc.assert(
        fc.property(seedArb, fc.nat(), (seed, pick) => {
          const start = create(seed, 100);
          const move = listMoves(start)[pick % listMoves(start).length];
          if (move === undefined) throw new Error('no legal move at the start');
          const twice = applyMove(applyMove(start, move).state, move).state;
          expect(twice.cells).toStrictEqual(start.cells);
        }),
      );
    });

    it('survives a JSON round trip unchanged (runs are saved as JSON)', () => {
      fc.assert(
        fc.property(seedArb, choicesArb, (seed, choices) => {
          const { states } = playChoices(RULES, create(seed, 50), choices);
          const last = states[states.length - 1];
          expect(JSON.parse(JSON.stringify(last)) as unknown).toStrictEqual(last);
        }),
      );
    });
  });
});
