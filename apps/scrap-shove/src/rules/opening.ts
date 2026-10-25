// apps/scrap-shove/src/rules/opening.ts
// Lays out a floor from the seed: the player near the centre, a pair of normal robots that crash
// on the first robots' turn (the first payoff comes on move 1), the other robots at a safe
// distance, one heap in each heavy robot's lane and the rest ahead of normal robots (the design
// fix: heaps in the robots' paths). Every number comes from the tuning file.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import {
  distanceBetween,
  isOnFloor,
  isSameCell,
  isTaken,
  neighboursOf,
  stepToward,
} from './floor-squares.ts';
import { TUNING } from './scrap-shove-tuning.ts';

import type { Cell, Floor, RobotKind } from './scrap-shove-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/**
 * A floor being laid out, with the random stream that lays it and the squares later pieces must
 * leave free (the opening pair's meet square: a piece there would stop the first crash).
 */
export type Layout = {
  readonly floor: Floor;
  readonly rng: RngState;
  readonly reserved?: readonly Cell[];
};

/** One seeded pick from a non-empty list (an empty list throws: the tuning never asks for one). */
export function drawFrom<T>(
  layout: Layout,
  items: readonly T[],
): { readonly item: T; readonly rng: RngState } {
  const draw = nextInt(layout.rng, items.length);
  return { item: pickAt(items, draw.value), rng: draw.state };
}

/** Free squares whose distance to the player lies in [min, max]. */
export function freeSquares(floor: Floor, min: number, max: number): Cell[] {
  const squares: Cell[] = [];
  for (let row = 0; row < TUNING.side; row += 1) {
    for (let col = 0; col < TUNING.side; col += 1) {
      const cell = { col, row };
      const distance = distanceBetween(cell, floor.player);
      if (distance >= min && distance <= max && !isTaken(floor, cell)) squares.push(cell);
    }
  }
  return squares;
}

function isReserved(layout: Layout, cell: Cell): boolean {
  return (layout.reserved ?? []).some((square) => isSameCell(square, cell));
}

/**
 * One seeded pick from free squares that is not reserved: a pick of a reserved square draws again
 * from the rest, so a layout that never meets a reserved square keeps every draw it had.
 */
function drawSquare(layout: Layout, squares: readonly Cell[]): ReturnType<typeof drawFrom<Cell>> {
  const pick = drawFrom(layout, squares);
  if (!isReserved(layout, pick.item)) return pick;
  const open = squares.filter((square) => !isReserved(layout, square));
  return drawFrom({ ...layout, rng: pick.rng }, open);
}

/** The layout with one more robot of `kind` on `cell` (the layout already carries the next rng). */
function withRobot(layout: Layout, kind: RobotKind, cell: Cell): Layout {
  const { floor } = layout;
  const robot = { id: floor.nextId, kind, ...cell };
  const robots = [...floor.robots, robot];
  return { ...layout, floor: { ...floor, robots, nextId: floor.nextId + 1 } };
}

function withHeap(layout: Layout, cell: Cell, rng: RngState): Layout {
  const { floor } = layout;
  const heap = { id: floor.nextId, ...cell, isShoved: false };
  const heaps = [...floor.heaps, heap];
  return { ...layout, floor: { ...floor, heaps, nextId: floor.nextId + 1 }, rng };
}

/** Pairs of free squares whose robots both step onto one square on the first robots' turn. */
function crashPairs(floor: Floor): (readonly [Cell, Cell])[] {
  const firsts = freeSquares(floor, TUNING.robotStartDistance, TUNING.crashPairMaxDistance);
  return firsts.flatMap((first) => {
    const meet = stepToward(first, floor.player);
    return neighboursOf(meet, TUNING.side)
      .filter((second) => !isSameCell(second, first) && !isTaken(floor, second))
      .filter((second) => distanceBetween(second, floor.player) >= TUNING.robotStartDistance)
      .filter((second) => isSameCell(stepToward(second, floor.player), meet))
      .map((second) => [first, second] as const);
  });
}

/**
 * The opening crash pair: two normal robots that meet on the first robots' turn. Their meet square
 * is reserved, so no robot or heap placed after them stands where they crash.
 */
export function placeCrashPair(layout: Layout): Layout {
  const pick = drawFrom(layout, crashPairs(layout.floor));
  const [first, second] = pick.item;
  const meet = stepToward(first, layout.floor.player);
  const reserved = [...(layout.reserved ?? []), meet];
  const withFirst = withRobot({ ...layout, rng: pick.rng, reserved }, 'normal', first);
  return withRobot(withFirst, 'normal', second);
}

/** How many robots of which kind, and how far from the player they start at least. */
export type RobotGroup = {
  readonly kind: RobotKind;
  readonly count: number;
  readonly minDistance: number;
};

/** A group of robots of one kind on free squares at least `minDistance` from the player. */
export function placeRobots(layout: Layout, group: RobotGroup): Layout {
  let placed = layout;
  for (let index = 0; index < group.count; index += 1) {
    const pick = drawSquare(placed, freeSquares(placed.floor, group.minDistance, TUNING.side));
    placed = withRobot({ ...placed, rng: pick.rng }, group.kind, pick.item);
  }
  return placed;
}

function randomHeap(layout: Layout): Layout {
  const pick = drawSquare(layout, freeSquares(layout.floor, TUNING.heapStartDistance, TUNING.side));
  return withHeap(layout, pick.item, pick.rng);
}

/** True when a heap may start on the square: on the floor, free and not reserved. */
function isHeapSquare(layout: Layout, cell: Cell): boolean {
  return isOnFloor(cell, TUNING.side) && !isTaken(layout.floor, cell) && !isReserved(layout, cell);
}

/** A heap in the lane of a heavy robot: two of its steps toward the player, else one, else anywhere. */
function laneHeap(layout: Layout, heavy: Cell): Layout {
  const { floor } = layout;
  const first = stepToward(heavy, floor.player);
  const second = stepToward(first, floor.player);
  if (isHeapSquare(layout, second)) return withHeap(layout, second, layout.rng);
  return isHeapSquare(layout, first) ? withHeap(layout, first, layout.rng) : randomHeap(layout);
}

/** A heap a few steps ahead of a seeded normal robot, or on a random square when that is taken. */
function leadHeap(layout: Layout): Layout {
  const normals = layout.floor.robots.filter((robot) => robot.kind === 'normal');
  const pick = drawFrom(layout, normals);
  let ahead: Cell = pick.item;
  for (let step = 0; step < TUNING.heapLeadSteps; step += 1)
    ahead = stepToward(ahead, layout.floor.player);
  const isFarEnough = distanceBetween(ahead, layout.floor.player) >= TUNING.heapStartDistance;
  const picked = { ...layout, rng: pick.rng };
  return isFarEnough && isHeapSquare(layout, ahead)
    ? withHeap(picked, ahead, pick.rng)
    : randomHeap(picked);
}

/** `count` heaps: one in each heavy robot's lane first, then ahead of normal robots. */
export function placeHeaps(layout: Layout, count: number): Layout {
  const heavies = layout.floor.robots.filter((robot) => robot.kind === 'heavy');
  let placed = layout;
  for (let index = 0; index < count; index += 1) {
    const heavy = heavies[index];
    placed = heavy === undefined ? leadHeap(placed) : laneHeap(placed, heavy);
  }
  return placed;
}
