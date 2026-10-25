// apps/trail-clear/src/rules/trail-clear-evaluate.test.ts
import { ALL_CELLS } from './board-cells.ts';
import { create } from './create.ts';
import { boardShape, evaluateTrailClear } from './trail-clear-evaluate.ts';
import { knobsFor } from './trail-clear-tuning.ts';

import type { PlacedTile, TileKind, TrailClearState } from './trail-clear-types.ts';

type Layout = Readonly<Record<number, readonly [TileKind, number]>>;

function boardOf(layout: Layout): (PlacedTile | null)[] {
  return ALL_CELLS.map((cell) => {
    const entry = layout[cell];
    return entry === undefined ? null : { kind: entry[0], turns: entry[1], placedAt: 1 };
  });
}

function stateWith(layout: Layout, score = 0): TrailClearState {
  return { ...create(1, 0), cells: boardOf(layout), score };
}

describe('boardShape', () => {
  it('counts the loose ends, the double spots and the empty cells', () => {
    const shape = boardShape(boardOf({ 7: ['road-end', 2], 17: ['river-end', 0] }), knobsFor(0));
    expect(shape).toStrictEqual({ looseEnds: 2, deadCells: 0, doubleSpots: 1, emptyCells: 23 });
  });

  it('counts an empty cell no dealt tile can fill as dead', () => {
    // The middle cell needs a road to the north and south and a river to the east and west: only a
    // bridge fits, and the easiest row never deals one.
    const crossed = {
      7: ['road-end', 2],
      17: ['road-end', 0],
      11: ['river-end', 1],
      13: ['river-end', 3],
    } as const;
    expect(boardShape(boardOf(crossed), knobsFor(0)).deadCells).toBe(1);
    expect(boardShape(boardOf(crossed), knobsFor(50)).deadCells).toBe(0);
  });
});

describe('evaluateTrailClear', () => {
  it('values points, room, a waiting double, and dislikes loose ends', () => {
    const empty = stateWith({});
    expect(evaluateTrailClear(stateWith({}, 40))).toBeGreaterThan(evaluateTrailClear(empty));
    expect(evaluateTrailClear(stateWith({ 12: ['road-end', 1] }))).toBeLessThan(
      evaluateTrailClear(empty),
    );
    const double = stateWith({ 7: ['road-end', 2], 17: ['river-end', 0] });
    const apart = stateWith({ 7: ['road-end', 2], 19: ['river-end', 0] });
    expect(evaluateTrailClear(double)).toBeGreaterThan(evaluateTrailClear(apart));
  });

  it('keeps the pinned value of the seed-1 opening', () => {
    expect(evaluateTrailClear(create(1, 0))).toBe(GOLDEN_SEED_1_VALUE);
  });
});

/** Seed 1, difficulty 0: 23 empty cells x 6, minus 2 loose ends x 4, plus 1 double spot x 8. */
const GOLDEN_SEED_1_VALUE = 138;
