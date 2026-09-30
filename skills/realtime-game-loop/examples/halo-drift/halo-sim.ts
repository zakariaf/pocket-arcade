// apps/halo-drift/src/sim/halo-sim.ts
'worklet';

import { nextU32, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** Flat typed-array state: lives in ONE shared value, mutated in place on the UI thread. */
export type HaloSim = {
  /** Per entity, stride 4: x, y, vx, vy. Entity 0 is the player. */
  readonly body: Float32Array;
  /** [tick, entityCount, lastCommand, eventCount, …event ints]. */
  readonly ints: Int32Array;
  readonly rng: Uint32Array;
};

export const MAX_ENTITIES = 64;
export const EVENT_INPUT = 1;
export const EVENT_HIT = 2;
const TICK = 0;
const COUNT = 1;
const LAST_COMMAND = 2;
const EVENT_COUNT = 3;
const EVENTS = 4;
const ARENA = 1000;
const PLAYER_SPEED = 3;
const ENEMY_SPEED = 1;
const HIT_RADIUS = 24;
/** 16 compass directions for the one-thumb stick (command 1…16; 0 = idle). */
const STICK = [
  1, 0, 0.92388, 0.38268, 0.70711, 0.70711, 0.38268, 0.92388, 0, 1, -0.38268, 0.92388, -0.70711,
  0.70711, -0.92388, 0.38268, -1, 0, -0.92388, -0.38268, -0.70711, -0.70711, -0.38268, -0.92388, 0,
  -1, 0.38268, -0.92388, 0.70711, -0.70711, 0.92388, -0.38268,
];

/** Draws from the sim's own sfc32 state, stored as 4 words in `sim.rng`. */
function drawU32(sim: HaloSim): number {
  const state: RngState = [sim.rng[0] ?? 0, sim.rng[1] ?? 0, sim.rng[2] ?? 0, sim.rng[3] ?? 0];
  const draw = nextU32(state);
  sim.rng.set(draw.state);
  return draw.value;
}

export function createHaloSim(seed: number, enemies: number): HaloSim {
  const sim: HaloSim = {
    body: new Float32Array(MAX_ENTITIES * 4),
    ints: new Int32Array(EVENTS + 256),
    rng: Uint32Array.from(seedRng(seed)),
  };
  const count = Math.min(enemies + 1, MAX_ENTITIES);
  sim.ints[COUNT] = count;
  sim.body[0] = ARENA / 2;
  sim.body[1] = ARENA / 2;
  for (let e = 1; e < count; e += 1) {
    sim.body[e * 4] = drawU32(sim) % ARENA;
    sim.body[e * 4 + 1] = drawU32(sim) % ARENA;
  }
  return sim;
}

function pushEvent(sim: HaloSim, kind: number, value: number): void {
  const at = EVENTS + (sim.ints[EVENT_COUNT] ?? 0) * 3;
  if (at + 2 >= sim.ints.length) return;
  sim.ints[at] = kind;
  sim.ints[at + 1] = value;
  sim.ints[at + 2] = sim.ints[TICK] ?? 0;
  sim.ints[EVENT_COUNT] = (sim.ints[EVENT_COUNT] ?? 0) + 1;
}

function movePlayer(sim: HaloSim, command: number): void {
  const dx = command === 0 ? 0 : (STICK[(command - 1) * 2] ?? 0);
  const dy = command === 0 ? 0 : (STICK[(command - 1) * 2 + 1] ?? 0);
  sim.body[0] = Math.min(ARENA, Math.max(0, (sim.body[0] ?? 0) + dx * PLAYER_SPEED));
  sim.body[1] = Math.min(ARENA, Math.max(0, (sim.body[1] ?? 0) + dy * PLAYER_SPEED));
}

function chase(sim: HaloSim, e: number): void {
  const dx = (sim.body[0] ?? 0) - (sim.body[e * 4] ?? 0);
  const dy = (sim.body[1] ?? 0) - (sim.body[e * 4 + 1] ?? 0);
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < HIT_RADIUS) {
    pushEvent(sim, EVENT_HIT, e);
    sim.body[e * 4] = drawU32(sim) % ARENA;
    return;
  }
  sim.body[e * 4] = (sim.body[e * 4] ?? 0) + (dx / distance) * ENEMY_SPEED;
  sim.body[e * 4 + 1] = (sim.body[e * 4 + 1] ?? 0) + (dy / distance) * ENEMY_SPEED;
}

/** One fixed tick. Records every command change as (tick, command) for replays. */
export function stepHaloSim(sim: HaloSim, command: number): void {
  if (command !== sim.ints[LAST_COMMAND]) {
    pushEvent(sim, EVENT_INPUT, command);
    sim.ints[LAST_COMMAND] = command;
  }
  movePlayer(sim, command);
  for (let e = 1; e < (sim.ints[COUNT] ?? 0); e += 1) chase(sim, e);
  sim.ints[TICK] = (sim.ints[TICK] ?? 0) + 1;
}

/** Copies this frame's events out as [kind, value, tick, …] and clears the queue. */
export function drainHaloEvents(sim: HaloSim): readonly number[] {
  const count = sim.ints[EVENT_COUNT] ?? 0;
  const events = Array.from(sim.ints.subarray(EVENTS, EVENTS + count * 3));
  sim.ints[EVENT_COUNT] = 0;
  return events;
}
