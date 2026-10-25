// apps/snare-snake/src/rules/list-moves.test.ts
// Snare Snake is turn-based with a 4-way swipe (design notes, Classification and Input): each move
// steers the head one cell up, right, down or left.
import fc from 'fast-check';

import { stepFrom } from './board-grid.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { Direction, SnareSnakeState } from './snare-snake-types.ts';

/** The cell index on the 7-column board of the easiest row. */
const at = (col: number, row: number): number => row * 7 + col;

/** The seed 1 level with the snake and critters replaced (the easiest row: a 7 x 8 board). */
function placed(
  snake: readonly number[],
  critters: readonly number[] = [at(6, 7)],
): SnareSnakeState {
  return { ...create(1, 0), snake, critters: critters.map((cell, id) => ({ id, cell })) };
}

const directions = (state: SnareSnakeState): string[] =>
  listMoves(state).map((move) => move.direction);

/** The target is on the board, not the neck and no critter. */
function isFreeTarget(state: SnareSnakeState, direction: Direction): boolean {
  const target = stepFrom(state, state.snake[0] ?? -1, direction);
  const isCritter = state.critters.some((critter) => critter.cell === target);
  return target !== null && target !== state.snake[1] && !isCritter;
}

/** No direction twice, and every listed one a free target. */
function listsCleanly(state: SnareSnakeState): boolean {
  const listed = directions(state);
  const isFree = listed.every((direction) => isFreeTarget(state, direction as Direction));
  return new Set(listed).size === listed.length && isFree;
}

describe('listMoves (spec 10 RULES: the list of moves allowed in a state)', () => {
  it('lists the three turns that do not reverse the snake, in the order up, right, down, left', () => {
    const state = placed([at(3, 3), at(2, 3), at(1, 3)]);
    expect(listMoves(state)).toStrictEqual([
      { kind: 'steer', direction: 'up' },
      { kind: 'steer', direction: 'right' },
      { kind: 'steer', direction: 'down' },
    ]);
  });

  it('lists no move off the board, back onto the neck or onto a critter', () => {
    expect(directions(placed([at(0, 1), at(1, 1), at(2, 1)], [at(0, 2)]))).toStrictEqual(['up']);
  });

  it('lists a move onto the snake body: it closes a loop', () => {
    const curled = placed([at(1, 1), at(2, 1), at(2, 2), at(1, 2), at(0, 2)]);
    expect(directions(curled)).toStrictEqual(['up', 'down', 'left']);
  });

  it('lists none when the snake is tangled: walls and critters on every free side', () => {
    const tangled = placed([at(0, 0), at(1, 0), at(2, 0)], [at(0, 1)]);
    expect(listMoves(tangled)).toStrictEqual([]);
    expect(outcome(tangled)).toStrictEqual({ kind: 'lost', reasonKey: 'snare-snake.lose.tangled' });
  });

  it('lists none once the level is over', () => {
    expect(listMoves({ ...create(1, 0), critters: [] })).toStrictEqual([]);
    expect(listMoves({ ...create(1, 0), moves: 30 })).toStrictEqual([]);
  });

  it('keeps the pinned moves of the seed 1 opening', () => {
    expect(directions(create(1, 0))).toStrictEqual(GOLDEN_SEED_1_DIRECTIONS);
  });

  it('lists no move twice, and every listed move enters a free cell on the board (property)', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        expect(listsCleanly(create(seed, difficulty))).toBe(true);
      }),
    );
  });
});

const GOLDEN_SEED_1_DIRECTIONS = ['right', 'down'];
