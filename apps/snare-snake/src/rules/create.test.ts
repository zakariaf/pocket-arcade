// apps/snare-snake/src/rules/create.test.ts
// Snare Snake is turn-based with a 4-way swipe (design notes, Classification and Input): create
// builds the start state of a level from its seed and difficulty.
import fc from 'fast-check';

import { neighboursOf } from './board-grid.ts';
import { create } from './create.ts';
import { outcome } from './outcome.ts';
import { TUNING, knobsFor } from './snare-snake-tuning.ts';

import type { SnareSnakeState } from './snare-snake-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

/** One cell of the board text: 'H' the head, '1'-'9' the body, 'c' a critter, '.' empty. */
function cellText(state: SnareSnakeState, cell: number): string {
  const segment = state.snake.indexOf(cell);
  if (segment === 0) return 'H';
  if (segment > 0) return String(segment % 10);
  return state.critters.some((critter) => critter.cell === cell) ? 'c' : '.';
}

/** Readable board text for pinned goldens, one line per row. */
function boardText(state: SnareSnakeState): string {
  const rowText = (row: number): string =>
    Array.from({ length: state.cols }, (_cell, col) =>
      cellText(state, row * state.cols + col),
    ).join('');
  return Array.from({ length: state.rows }, (_row, row) => rowText(row)).join('\n');
}

function touchesSnake(state: SnareSnakeState, cell: number): boolean {
  return neighboursOf(state, cell).some((next) => state.snake.includes(next));
}

/** True when the snake is startLength distinct cells on the board, each next to the one before. */
function isOneChain(state: SnareSnakeState): boolean {
  const { snake, cols, rows } = state;
  const isOnBoard = snake.every((cell) => cell >= 0 && cell < cols * rows);
  const isLinked = snake
    .slice(1)
    .every((cell, index) => neighboursOf(state, cell).includes(snake[index] ?? -1));
  return (
    snake.length === TUNING.startLength &&
    new Set(snake).size === snake.length &&
    isOnBoard &&
    isLinked
  );
}

/** Which critters touch the snake, in id order (the nest ones do, the roamers never). */
function touching(state: SnareSnakeState): boolean[] {
  return state.critters.map((critter) => touchesSnake(state, critter.cell));
}

/** The critters as the tests see them: ids, distinct cells off the snake, which ones touch it. */
function critterLayout(state: SnareSnakeState): object {
  const cells = state.critters.map((critter) => critter.cell);
  return {
    ids: state.critters.map((critter) => critter.id),
    distinct: new Set(cells).size,
    onSnake: cells.filter((cell) => state.snake.includes(cell)).length,
    touching: touching(state),
  };
}

/** The layout the opening promises: ids 0.., all distinct and off the snake, the nest ones touching. */
function expectedLayout(state: SnareSnakeState, difficulty: number): object {
  const count = state.critters.length;
  const nest = knobsFor(difficulty).nestCritters;
  return {
    ids: Array.from({ length: count }, (_slot, id) => id),
    distinct: count,
    onSnake: 0,
    touching: Array.from({ length: count }, (_slot, id) => id < nest),
  };
}

/** Cells the head may enter at the start: not the neck, not a critter. */
function openCells(state: SnareSnakeState): number[] {
  const [head = -1, neck] = state.snake;
  const taken = new Set(state.critters.map((critter) => critter.cell));
  return neighboursOf(state, head).filter((cell) => cell !== neck && !taken.has(cell));
}

describe('create (spec 10 RULES: the start state from its seed and difficulty)', () => {
  it('keeps the pinned board for seed 1 at difficulty 0 (a changed board breaks saved levels)', () => {
    const state = create(1, 0);
    expect(boardText(state)).toBe(GOLDEN_SEED_1_BOARD);
    expect({ moves: state.moves, maxMoves: state.maxMoves, total: state.total }).toStrictEqual({
      moves: 0,
      maxMoves: 30,
      total: 4,
    });
  });

  it('takes the board, the critters and the moves from the tuning row of the difficulty', () => {
    const state = create(7, 80);
    const knobs = knobsFor(80);
    expect([state.cols, state.rows, state.critters.length, state.maxMoves]).toStrictEqual([
      knobs.cols,
      knobs.rows,
      knobs.critters,
      knobs.maxMoves,
    ]);
  });

  it('clamps difficulties outside 0..100', () => {
    expect(create(5, -3)).toStrictEqual(create(5, 0));
    expect(create(5, 250)).toStrictEqual(create(5, 100));
  });

  it('gives different seeds different layouts', () => {
    const layouts = new Set(Array.from({ length: 50 }, (_, seed) => boardText(create(seed, 30))));
    expect(layouts.size).toBeGreaterThanOrEqual(45);
  });

  describe('properties', () => {
    it('gives the same state for the same seed and difficulty', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(create(seed, difficulty)).toStrictEqual(create(seed, difficulty));
        }),
      );
    });

    it('starts every level unfinished', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(outcome(create(seed, difficulty)).kind).toBe('playing');
        }),
      );
    });

    it('starts the snake as one chain of startLength cells on the board (the design fix: longer)', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(isOneChain(create(seed, difficulty))).toBe(true);
        }),
      );
    });

    it('puts the nest critters inside the coil and the others away from the snake', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          const state = create(seed, difficulty);
          expect(critterLayout(state)).toStrictEqual(expectedLayout(state, difficulty));
        }),
      );
    });

    it('leaves the head a free cell into the open gap of its coil', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, (seed, difficulty) => {
          expect(openCells(create(seed, difficulty)).length).toBeGreaterThan(0);
        }),
      );
    });
  });
});

const GOLDEN_SEED_1_BOARD = [
  '....c..',
  '.......',
  '..432..',
  '..5c1..',
  '..6cH..',
  '..7....',
  '.98.c..',
  '.......',
].join('\n');
