// apps/demo-arena/src/sim/demo-arena-sim.ts
'worklet';

import { nextU32, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { speedFor } from './tuning.ts';

import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** Flat typed-array state: lives in ONE shared value and is mutated in place on the UI thread. */
export type DemoArenaSim = {
  /** Per entity, stride 4: x, y, vx, vy in world units. Entity 0 is the player. */
  readonly body: Float32Array;
  /** Header [tick, entityCount, lastCommand, eventCount], then event triples [kind, value, tick]. */
  readonly ints: Int32Array;
  /** The sim's own sfc32 state (4 words). */
  readonly rng: Uint32Array;
};

export const MAX_ENTITIES = 64;
export const MAX_EVENTS = 128;
/** World size in world units; the view scales it to the canvas. */
export const ARENA = 1000;
export const EVENT_INPUT = 1;
export const EVENT_EDGE = 2;
const TICK = 0;
const COUNT = 1;
const LAST_COMMAND = 2;
const EVENT_COUNT = 3;
const EVENTS = 4;
/** World units per tick at full stick. Speeds are per tick, never per millisecond. */
const PLAYER_SPEED = speedFor(1);
/** Command k (1…16) = (cos((k-1)·22.5°), sin((k-1)·22.5°)), y down; the stick gesture uses the same table. */
const STICK = [
  1, 0, 0.9238795325112867, 0.3826834323650898, 0.7071067811865476, 0.7071067811865476,
  0.3826834323650898, 0.9238795325112867, 0, 1, -0.3826834323650898, 0.9238795325112867,
  -0.7071067811865476, 0.7071067811865476, -0.9238795325112867, 0.3826834323650898, -1, 0,
  -0.9238795325112867, -0.3826834323650898, -0.7071067811865476, -0.7071067811865476,
  -0.3826834323650898, -0.9238795325112867, 0, -1, 0.3826834323650898, -0.9238795325112867,
  0.7071067811865476, -0.7071067811865476, 0.9238795325112867, -0.3826834323650898,
];

/** Draws from the sim's own sfc32 state, stored as 4 words in `sim.rng`. */
function drawU32(sim: DemoArenaSim): number {
  const state: RngState = [sim.rng[0] ?? 0, sim.rng[1] ?? 0, sim.rng[2] ?? 0, sim.rng[3] ?? 0];
  const draw = nextU32(state);
  sim.rng.set(draw.state);
  return draw.value;
}

/** Allocates every buffer once; nothing is allocated per tick. */
export function createDemoArenaSim(seed: number, entities: number): DemoArenaSim {
  const sim: DemoArenaSim = {
    body: new Float32Array(MAX_ENTITIES * 4),
    ints: new Int32Array(EVENTS + MAX_EVENTS * 3),
    rng: Uint32Array.from(seedRng(seed)),
  };
  const count = Math.min(entities + 1, MAX_ENTITIES);
  sim.ints[COUNT] = count;
  sim.body[0] = ARENA / 2;
  sim.body[1] = ARENA / 2;
  for (let e = 1; e < count; e += 1) {
    sim.body[e * 4] = drawU32(sim) % ARENA;
    sim.body[e * 4 + 1] = drawU32(sim) % ARENA;
    sim.body[e * 4 + 2] = (drawU32(sim) % 5) - 2;
    sim.body[e * 4 + 3] = (drawU32(sim) % 5) - 2;
  }
  return sim;
}

/** Appends one [kind, value, tick] triple; a full queue drops the event instead of allocating. */
function pushEvent(sim: DemoArenaSim, kind: number, value: number): void {
  const at = EVENTS + (sim.ints[EVENT_COUNT] ?? 0) * 3;
  if (at + 2 >= sim.ints.length) return;
  sim.ints[at] = kind;
  sim.ints[at + 1] = value;
  sim.ints[at + 2] = sim.ints[TICK] ?? 0;
  sim.ints[EVENT_COUNT] = (sim.ints[EVENT_COUNT] ?? 0) + 1;
}

function movePlayer(sim: DemoArenaSim, command: number): void {
  const dx = command === 0 ? 0 : (STICK[(command - 1) * 2] ?? 0);
  const dy = command === 0 ? 0 : (STICK[(command - 1) * 2 + 1] ?? 0);
  sim.body[0] = Math.min(ARENA, Math.max(0, (sim.body[0] ?? 0) + dx * PLAYER_SPEED));
  sim.body[1] = Math.min(ARENA, Math.max(0, (sim.body[1] ?? 0) + dy * PLAYER_SPEED));
}

/** Moves one axis (0 = x, 1 = y) of entity e by its velocity, bouncing off the arena edge. */
function moveAxis(sim: DemoArenaSim, e: number, axis: number): boolean {
  const next = (sim.body[e * 4 + axis] ?? 0) + (sim.body[e * 4 + 2 + axis] ?? 0);
  const isOutside = next < 0 || next > ARENA;
  if (isOutside) sim.body[e * 4 + 2 + axis] = -(sim.body[e * 4 + 2 + axis] ?? 0);
  sim.body[e * 4 + axis] = Math.min(ARENA, Math.max(0, next));
  return isOutside;
}

/** Gameplay slot: replace with the game's rules (chase, collide, spawn). Integer-safe maths only. */
function moveEntity(sim: DemoArenaSim, e: number): void {
  const isBounceX = moveAxis(sim, e, 0);
  const isBounceY = moveAxis(sim, e, 1);
  if (isBounceX || isBounceY) pushEvent(sim, EVENT_EDGE, e);
}

/** One fixed tick. Records every command change as (tick, command) for replays. */
export function stepDemoArenaSim(sim: DemoArenaSim, command: number): void {
  if (command !== sim.ints[LAST_COMMAND]) {
    pushEvent(sim, EVENT_INPUT, command);
    sim.ints[LAST_COMMAND] = command;
  }
  movePlayer(sim, command);
  for (let e = 1; e < (sim.ints[COUNT] ?? 0); e += 1) moveEntity(sim, e);
  sim.ints[TICK] = (sim.ints[TICK] ?? 0) + 1;
}

/** Copies this frame's events out as [kind, value, tick, …] and clears the queue. */
export function drainDemoArenaEvents(sim: DemoArenaSim): readonly number[] {
  const count = sim.ints[EVENT_COUNT] ?? 0;
  const events = Array.from(sim.ints.subarray(EVENTS, EVENTS + count * 3));
  sim.ints[EVENT_COUNT] = 0;
  return events;
}

/** Current tick (gameplay time is ticks, never milliseconds). */
export function simTick(sim: DemoArenaSim): number {
  return sim.ints[TICK] ?? 0;
}
