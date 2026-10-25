// apps/toggle-drop/src/rules/simulate-drop.test.ts
import fc from 'fast-check';

import { STEP_MS } from '@e07/game-kit/timeline/fixed-step.ts';

import { create } from './create.ts';
import { dropPath } from './drop-path.ts';
import { CELL_UNITS, FALL_PER_TICK, simulateDrop } from './simulate-drop.ts';

import type { PegBoard } from './drop-path.ts';
import type { Fall, FallPoint } from './simulate-drop.ts';

/** Row 0: a right switch in the middle; row 1: left switches at both ends. */
const BOARD: PegBoard = { cols: 3, rows: 2, pegs: [-1, 1, -1, 0, -1, 0] };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 99 });

/** Every drop of a seeded board: one fall per column. */
function fallsOf(seed: number, difficulty: number): { board: PegBoard; falls: Fall[] } {
  const board = create(seed, difficulty);
  const falls = Array.from({ length: board.cols }, (_, col) => simulateDrop(board, col));
  return { board, falls };
}

/** The ticks between two points: atMs counts fixed steps of STEP_MS, rounded. */
function ticksBetween(a: FallPoint, b: FallPoint): number {
  return Math.round((b.atMs - a.atMs) / STEP_MS);
}

/** The switches a fall met: its row points as drop-path steps. */
function metSwitches(fall: Fall): { row: number; col: number; side: FallPoint['side'] }[] {
  return fall.points
    .filter((point) => point.kind === 'row')
    .map(({ row, col, side }) => ({ row, col, side }));
}

/** The times of a fall's points. */
function timesOf(fall: Fall): number[] {
  return fall.points.map((point) => point.atMs);
}

/** Problems of one fall: a point outside the board, or a move faster than the fall speed. */
function fallProblems(board: PegBoard, points: readonly FallPoint[]): string[] {
  const problems: string[] = [];
  const width = board.cols * CELL_UNITS;
  const floor = (board.rows + 1) * CELL_UNITS;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const before = points[index - 1] ?? point;
    if (point === undefined || before === undefined) continue;
    if (point.x < 0 || point.x > width || point.y < 0 || point.y > floor) {
      problems.push(`outside at ${String(index)}`);
    }
    const reach = FALL_PER_TICK * ticksBetween(before, point);
    const dx = point.x - before.x;
    const dy = point.y - before.y;
    if (dx * dx + dy * dy > 2 * reach * reach) problems.push(`too fast at ${String(index)}`);
  }
  return problems;
}

describe('simulateDrop', () => {
  // Spec 13 (toggle-drop): "the drop is simulated inside the move and replayed".
  it('falls in fixed steps and turns at each switch, with a time on every point', () => {
    const fall = simulateDrop(BOARD, 1);
    expect(fall.points).toStrictEqual(GOLDEN_BOARD_DROP_1);
    expect(fall.land).toStrictEqual(GOLDEN_BOARD_DROP_1.at(-1));
  });

  it('stops at maxTicks however far the ball still has to fall', () => {
    const fall = simulateDrop(BOARD, 1, 10);
    expect(fall.land).toStrictEqual({
      kind: 'land',
      col: 1,
      row: 2,
      side: null,
      x: 180,
      y: 60,
      atMs: Math.round(10 * STEP_MS),
      isCapped: true,
    });
    expect(fall.points.at(-1)).toStrictEqual(fall.land);
  });

  it('meets the same switches and lands where the drop path says (property)', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const { board, falls } = fallsOf(seed, difficulty);
        const met = falls.map(metSwitches);
        const paths = falls.map((_, col) => dropPath(board, col));
        expect(met).toStrictEqual(paths.map((path) => path.steps));
        expect(falls.map((fall) => fall.land.col)).toStrictEqual(paths.map((path) => path.landing));
      }),
    );
  });

  it('keeps the ball inside the board and never speeds it up (property)', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const { board, falls } = fallsOf(seed, difficulty);
        expect(falls.flatMap((fall) => fallProblems(board, fall.points))).toStrictEqual([]);
      }),
    );
  });

  it('gives the same timed fall for the same board and column, and always lands (property)', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const first = fallsOf(seed, difficulty).falls;
        expect(fallsOf(seed, difficulty).falls).toStrictEqual(first);
        expect(first.every((fall) => fall.land.kind === 'land' && !fall.land.isCapped)).toBe(true);
        const times = first.flatMap(timesOf);
        expect(times.every((atMs) => Number.isInteger(atMs))).toBe(true);
      }),
    );
  });
});

const GOLDEN_BOARD_DROP_1: readonly FallPoint[] = [
  { kind: 'start', col: 1, row: -1, side: null, x: 180, y: 0, atMs: 0, isCapped: false },
  { kind: 'row', col: 1, row: 0, side: 1, x: 180, y: 120, atMs: 167, isCapped: false },
  { kind: 'row', col: 2, row: 1, side: 0, x: 300, y: 240, atMs: 333, isCapped: false },
  { kind: 'land', col: 1, row: 2, side: null, x: 180, y: 360, atMs: 500, isCapped: false },
];
