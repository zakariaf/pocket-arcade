// apps/scrap-shove/src/rules/robots-turn.ts
// The robots' turn: every robot steps toward the player, the nearest first (ties by id), so a robot
// never runs into one that was about to move away; then the fast robots step once more. A robot
// that steps onto scrap is wrecked (a heavy one shoves the heap instead, crushing any robot behind
// it, or smashes a heap it cannot shove); two robots on one square crash into a heap; a robot that
// runs into a heavy one breaks down on its own square. A robot that steps onto the player catches
// them and the turn stops.
import {
  beyond,
  distanceBetween,
  heapAt,
  isOnFloor,
  isSameCell,
  robotAt,
  stepToward,
} from './floor-squares.ts';

import type { Cell, Floor, Heap, Robot, RobotStep, ScrapShoveEvent } from './scrap-shove-types.ts';

/** A robots' turn in progress. */
export type Turn = {
  readonly floor: Floor;
  readonly side: number;
  readonly steps: readonly RobotStep[];
  readonly events: readonly ScrapShoveEvent[];
  readonly caughtBy: number | null;
};

function cellOf(piece: Cell): Cell {
  return { col: piece.col, row: piece.row };
}

function withoutRobots(floor: Floor, ids: readonly number[]): Floor {
  return { ...floor, robots: floor.robots.filter((robot) => !ids.includes(robot.id)) };
}

function movedRobot(floor: Floor, id: number, to: Cell): Floor {
  const robots = floor.robots.map((robot) =>
    robot.id === id ? { ...robot, col: to.col, row: to.row } : robot,
  );
  return { ...floor, robots };
}

function withNewHeap(floor: Floor, at: Cell): Floor {
  const heap: Heap = { id: floor.nextId, ...at, isShoved: false };
  return { ...floor, heaps: [...floor.heaps, heap], nextId: floor.nextId + 1 };
}

/** The turn with the robot's step recorded (to equals its square when it waited). */
function stepped(turn: Turn, robot: Robot, to: Cell): Turn {
  return {
    ...turn,
    steps: [
      ...turn.steps,
      { robotId: robot.id, robotKind: robot.kind, from: cellOf(robot), to: cellOf(to) },
    ],
  };
}

function withEvents(turn: Turn, events: readonly ScrapShoveEvent[]): Turn {
  return { ...turn, events: [...turn.events, ...events] };
}

/** A normal or fast robot drives into scrap: it is wrecked, the heap stays. */
function wreckOnScrap(turn: Turn, robot: Robot, heap: Heap): Turn {
  const crash: ScrapShoveEvent = {
    kind: 'robots-crashed',
    robotIds: [robot.id],
    at: cellOf(heap),
    cause: 'scrap',
    heapId: heap.id,
    isShovedScrap: heap.isShoved,
  };
  const moved = stepped(turn, robot, heap);
  return withEvents({ ...moved, floor: withoutRobots(turn.floor, [robot.id]) }, [crash]);
}

/** True when a heavy robot cannot shove the heap to `target` (wall, another heap, the player). */
function isShoveBlocked(turn: Turn, target: Cell): boolean {
  const { floor } = turn;
  const isOff = !isOnFloor(target, turn.side);
  return isOff || heapAt(floor, target) !== null || isSameCell(target, floor.player);
}

/**
 * A heavy robot that cannot shove its heap smashes it to pieces and stays put: no heap shields
 * the player for ever, so every floor ends (the bots found endless standoffs without this).
 */
function smashHeap(turn: Turn, robot: Robot, heap: Heap): Turn {
  const smashed: ScrapShoveEvent = {
    kind: 'scrap-smashed',
    heapId: heap.id,
    at: cellOf(heap),
    byRobotId: robot.id,
  };
  const heaps = turn.floor.heaps.filter((piece) => piece.id !== heap.id);
  return withEvents({ ...stepped(turn, robot, robot), floor: { ...turn.floor, heaps } }, [smashed]);
}

/**
 * A heavy robot shoves the heap ahead of it; a robot behind the heap is crushed. The heap keeps
 * the player's shove mark: a robot wrecked on it later is still the player's twist.
 */
function heavyShove(turn: Turn, robot: Robot, heap: Heap): Turn {
  const target = beyond(robot, heap);
  if (isShoveBlocked(turn, target)) return smashHeap(turn, robot, heap);
  const { floor } = turn;
  const victim = robotAt(floor, target);
  const heaps = floor.heaps.map((piece) =>
    piece.id === heap.id ? { ...piece, ...target } : piece,
  );
  const pushed = movedRobot({ ...floor, heaps }, robot.id, heap);
  const shoved: ScrapShoveEvent = {
    kind: 'scrap-shoved',
    heapId: heap.id,
    from: cellOf(heap),
    to: target,
    byRobotId: robot.id,
  };
  const moved = stepped({ ...turn, floor: pushed }, robot, heap);
  if (victim === null) return withEvents(moved, [shoved]);
  const crushed: ScrapShoveEvent = {
    kind: 'robot-crushed',
    robotId: victim.id,
    robotKind: victim.kind,
    at: target,
    heapId: heap.id,
    isByPlayer: false,
  };
  return withEvents({ ...moved, floor: withoutRobots(pushed, [victim.id]) }, [shoved, crushed]);
}

/** Which robots a crash scraps, and the square their heap lands on. */
type Wreck = { readonly ids: readonly number[]; readonly at: Cell };

/** Robots scrapped into a new heap, with the crash event; the robot is the one that moved. */
function scrapped(turn: Turn, robot: Robot, wreck: Wreck): Turn {
  const { ids, at } = wreck;
  const cause = ids.length === 2 ? 'robot' : 'heavy';
  const crash: ScrapShoveEvent = {
    kind: 'robots-crashed',
    robotIds: ids,
    at,
    cause,
    heapId: turn.floor.nextId,
    isShovedScrap: false,
  };
  // Two plain robots end on the crash square; against a heavy robot nobody moves.
  const moved = stepped(turn, robot, cause === 'robot' ? at : robot);
  return withEvents({ ...moved, floor: withNewHeap(withoutRobots(turn.floor, ids), at) }, [crash]);
}

/**
 * The robot steps onto another one: two plain robots crash into one heap there; against a heavy
 * robot only the other one breaks, on its own square; two heavy robots just stop.
 */
function crashInto(turn: Turn, robot: Robot, other: Robot): Turn {
  const isMoverHeavy = robot.kind === 'heavy';
  const isOtherHeavy = other.kind === 'heavy';
  if (isMoverHeavy && isOtherHeavy) return stepped(turn, robot, robot);
  if (!isMoverHeavy && !isOtherHeavy) {
    return scrapped(turn, robot, { ids: [other.id, robot.id], at: cellOf(other) });
  }
  const weak = isMoverHeavy ? other : robot;
  return scrapped(turn, robot, { ids: [weak.id], at: cellOf(weak) });
}

function catchPlayer(turn: Turn, robot: Robot, at: Cell): Turn {
  const caught: ScrapShoveEvent = { kind: 'player-caught', robotId: robot.id, at };
  const moved = stepped({ ...turn, floor: movedRobot(turn.floor, robot.id, at) }, robot, at);
  return withEvents({ ...moved, caughtBy: robot.id }, [caught]);
}

/** One robot's step of the turn (a robot scrapped earlier in the turn, or a finished turn, skips). */
export function robotStep(turn: Turn, id: number): Turn {
  const robot = turn.floor.robots.find((piece) => piece.id === id);
  if (robot === undefined || turn.caughtBy !== null) return turn;
  const target = stepToward(robot, turn.floor.player);
  if (isSameCell(target, turn.floor.player)) return catchPlayer(turn, robot, target);
  const heap = heapAt(turn.floor, target);
  if (heap !== null) {
    return robot.kind === 'heavy' ? heavyShove(turn, robot, heap) : wreckOnScrap(turn, robot, heap);
  }
  const other = robotAt(turn.floor, target);
  if (other !== null) return crashInto(turn, robot, other);
  return stepped({ ...turn, floor: movedRobot(turn.floor, id, target) }, robot, target);
}

/** The ids of the robots that move in this phase, nearest to the player first, ties by id. */
export function stepOrder(floor: Floor, isMoving: (robot: Robot) => boolean): number[] {
  return floor.robots
    .filter(isMoving)
    .map((robot) => ({ id: robot.id, distance: distanceBetween(robot, floor.player) }))
    .sort((a, b) => (a.distance === b.distance ? a.id - b.id : a.distance - b.distance))
    .map((entry) => entry.id);
}

/**
 * One phase of the robots' turn: the moving robots step in order, then one robots-stepped event
 * (every step, for the animation) comes before the crashes and the catch it caused.
 */
export function runPhase(floor: Floor, side: number, isMoving: (robot: Robot) => boolean): Turn {
  const start: Turn = { floor, side, steps: [], events: [], caughtBy: null };
  const done = stepOrder(floor, isMoving).reduce(robotStep, start);
  const stepsEvent: ScrapShoveEvent = { kind: 'robots-stepped', steps: done.steps };
  return { ...done, events: done.steps.length === 0 ? done.events : [stepsEvent, ...done.events] };
}

/** The whole robots' turn: every robot, then the fast ones again (unless the player was caught). */
export function robotsTurn(floor: Floor, side: number): Turn {
  const first = runPhase(floor, side, () => true);
  if (first.caughtBy !== null) return first;
  const second = runPhase(first.floor, side, (robot) => robot.kind === 'fast');
  return {
    ...second,
    steps: [...first.steps, ...second.steps],
    events: [...first.events, ...second.events],
  };
}
