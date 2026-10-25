// apps/snare-snake/src/rules/snare-snake-evaluate.ts
// How good a Snare Snake position looks to a reasonable player. Lives in rules/ because both the
// bots (testing/) and the level witness (levels/) play with it, and levels may import only rules.
// A person counts the critters caught, looks for a loop they can close soon (a closer one first),
// curls around critters (touching freezes them), keeps the snake long enough to make loops, heads
// for the nearest critter and keeps room ahead of the head.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { DIRECTIONS, neighboursOf, stepFrom, touchingCells } from './board-grid.ts';
import { enclosedBy, snaredBy } from './snare-loop.ts';
import { targetOf } from './steering.ts';

import type { SnareSnakeState } from './snare-snake-types.ts';

/** Weights: a caught critter is worth most; the rest only steer the search toward the next one. */
const CAUGHT_WEIGHT = 1000;
const SNARE_WEIGHT = 100;
const WRAP_WEIGHT = 10;
const CONTACT_WEIGHT = 20;
const LENGTH_WEIGHT = 8;
const LENGTH_CAP = 16;
const DISTANCE_WEIGHT = 6;
const ROOM_WEIGHT = 4;
const ROOM_CAP = 12;
const CRAMPED_ROOM = 3;
const CRAMPED_PENALTY = 400;
/** Moves the bot looks ahead for a loop it can close (the snake only; critters held still). */
const SNARE_HORIZON = 3;

/** Critters a bite at `target` would catch now. */
function snareCount(state: SnareSnakeState, target: number): number {
  const loop = state.snake.slice(0, state.snake.indexOf(target) + 1);
  const snared = snaredBy(state, loop, enclosedBy(state, loop));
  return state.critters.filter((critter) => snared.has(critter.cell)).length;
}

/** The value of steering onto `target`: a loop's catch now, or the best loop after it. */
function snareAt(state: SnareSnakeState, target: number, depth: number): number {
  if (state.snake.includes(target)) return snareCount(state, target) * (depth + 1);
  if (depth <= 1) return 0;
  return bestSnare({ ...state, snake: [target, ...state.snake.slice(0, -1)] }, depth - 1);
}

/** The best loop within `depth` snake moves: critters it catches, weighted by how soon. */
export function bestSnare(state: SnareSnakeState, depth: number): number {
  let best = 0;
  for (const direction of DIRECTIONS) {
    const target = targetOf(state, direction);
    if (target !== null) best = Math.max(best, snareAt(state, target, depth));
  }
  return best;
}

/** How walled in the most surrounded critter is: a square of its sides with snake along the line. */
function wrapOf(state: SnareSnakeState): number {
  const body = new Set(state.snake);
  let best = 0;
  for (const critter of state.critters) {
    const rays = DIRECTIONS.filter((direction) => {
      for (
        let cell = stepFrom(state, critter.cell, direction);
        cell !== null;
        cell = stepFrom(state, cell, direction)
      ) {
        if (body.has(cell)) return true;
      }
      return false;
    }).length;
    best = Math.max(best, rays * rays);
  }
  return best;
}

/** Free cells the head can reach, counted up to ROOM_CAP. */
function roomAhead(state: SnareSnakeState): number {
  const blocked = new Set([...state.snake, ...state.critters.map((critter) => critter.cell)]);
  const head = pickAt(state.snake, 0);
  const seen = new Set([head]);
  const stack = [head];
  for (let cell = stack.pop(); cell !== undefined && seen.size <= ROOM_CAP; cell = stack.pop()) {
    for (const next of neighboursOf(state, cell)) {
      if (blocked.has(next) || seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return Math.min(seen.size - 1, ROOM_CAP);
}

/** Steps from the head to the nearest critter (0 with none left). */
function nearestCritter(state: SnareSnakeState): number {
  const head = pickAt(state.snake, 0);
  const distances = state.critters.map(
    (critter) =>
      Math.abs((critter.cell % state.cols) - (head % state.cols)) +
      Math.abs(Math.floor(critter.cell / state.cols) - Math.floor(head / state.cols)),
  );
  return distances.length === 0 ? 0 : Math.min(...distances);
}

/** How good a position looks to the bots (higher is better). */
export function evaluateSnareSnake(state: SnareSnakeState): number {
  const near = touchingCells(state, state.snake);
  const contact = state.critters.filter((critter) => near.has(critter.cell)).length;
  const room = roomAhead(state);
  return (
    state.caught * CAUGHT_WEIGHT +
    bestSnare(state, SNARE_HORIZON) * SNARE_WEIGHT +
    wrapOf(state) * WRAP_WEIGHT +
    contact * CONTACT_WEIGHT +
    Math.min(state.snake.length, LENGTH_CAP) * LENGTH_WEIGHT -
    nearestCritter(state) * DISTANCE_WEIGHT +
    room * ROOM_WEIGHT -
    (room < CRAMPED_ROOM ? CRAMPED_PENALTY : 0)
  );
}
