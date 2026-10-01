// apps/halo-drift/src/testing/halo-drift-bot.ts
// The real-time game's bot hooks: the sim members runSimBot drives, which events are the payoff and
// the twist, and the three standard real-time players (idle, wander, dodge) as command policies.
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';
import {
  ARENA,
  chaserCount,
  createHaloDriftSim,
  drainHaloDriftEvents,
  EVENT_PULSE,
  EVENT_SPARK,
  FIRST_CHASER,
  haloDriftOutcome,
  haloDriftScore,
  PLAYER,
  SPARK,
  STICK,
  stepHaloDriftSim,
} from '@e07/halo-drift/sim/halo-drift-sim.ts';

import type { CommandPolicy, SimBotGame } from '@e07/game-kit/testing/run-sim-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type { HaloDriftSim } from '@e07/halo-drift/sim/halo-drift-sim.ts';

/** How close a chaser must be before the dodge player turns away from it (arena units). */
const DANGER_RADIUS = 200;
/** How strongly a close chaser pushes the dodge player away, against the pull of the spark. */
const AVOID_WEIGHT = 2.5;
/** Walls closer than this push the dodge player back towards the middle (corners are traps). */
const WALL_MARGIN = 90;
const DIRECTIONS = STICK.length / 2;

/** Payoff: a spark collected. Twist: the halo pulse throwing at least one chaser back. */
export function tagHaloDriftEvent(kind: number, value: number): readonly EventTag[] {
  if (kind === EVENT_SPARK) return ['payoff'];
  return kind === EVENT_PULSE && value > 0 ? ['twist'] : [];
}

/** What runSimBot drives: the same step and drain the UI thread runs, headless. */
export const HALO_DRIFT_SIM: SimBotGame<HaloDriftSim> = {
  create: createHaloDriftSim,
  step: stepHaloDriftSim,
  drainEvents: drainHaloDriftEvents,
  outcome: haloDriftOutcome,
  scoreOf: haloDriftScore,
  tagEvent: tagHaloDriftEvent,
};

/** The stick command (1-16) that points closest to (dx, dy): the best dot product, no angles. */
export function commandToward(dx: number, dy: number): number {
  let best = 1;
  let bestDot = -Infinity;
  for (let command = 1; command <= DIRECTIONS; command += 1) {
    const dot = (STICK[(command - 1) * 2] ?? 0) * dx + (STICK[(command - 1) * 2 + 1] ?? 0) * dy;
    if (dot > bestDot) {
      best = command;
      bestDot = dot;
    }
  }
  return best;
}

/** Baseline: never touches the stick. Must lose fast, or the chasers are toothless. */
export const idlePolicy: CommandPolicy<HaloDriftSim> = (_sim, rng) => ({ command: 0, rng });

/** A random direction every decision: how far someone gets without looking. */
export const wanderPolicy: CommandPolicy<HaloDriftSim> = (_sim, rng) => {
  const draw = nextInt(rng, DIRECTIONS);
  return { command: draw.value + 1, rng: draw.state };
};

function wallPush(position: number): number {
  if (position < WALL_MARGIN) return (WALL_MARGIN - position) / WALL_MARGIN;
  return position > ARENA - WALL_MARGIN ? (ARENA - WALL_MARGIN - position) / WALL_MARGIN : 0;
}

/** Length of a vector, or 1 for the zero vector (so dividing by it is always safe). */
function lengthOf(x: number, y: number): number {
  const length = Math.sqrt(x * x + y * y);
  return length === 0 ? 1 : length;
}

/** The pushes away from every chaser inside DANGER_RADIUS, stronger the closer it is. */
function awayFromChasers(sim: HaloDriftSim, px: number, py: number): readonly [number, number] {
  let x = 0;
  let y = 0;
  for (let index = 0; index < chaserCount(sim); index += 1) {
    const awayX = px - (sim.body[FIRST_CHASER + index * 2] ?? 0);
    const awayY = py - (sim.body[FIRST_CHASER + index * 2 + 1] ?? 0);
    const distance = lengthOf(awayX, awayY);
    if (distance < DANGER_RADIUS) {
      const urgency = ((DANGER_RADIUS - distance) / DANGER_RADIUS) * AVOID_WEIGHT;
      x += (awayX / distance) * urgency;
      y += (awayY / distance) * urgency;
    }
  }
  return [x, y];
}

/** The reasonable player: heads for the spark, veers away from close chasers and walls. */
export const dodgePolicy: CommandPolicy<HaloDriftSim> = (sim, rng) => {
  const px = sim.body[PLAYER] ?? 0;
  const py = sim.body[PLAYER + 1] ?? 0;
  const toSparkX = (sim.body[SPARK] ?? 0) - px;
  const toSparkY = (sim.body[SPARK + 1] ?? 0) - py;
  const sparkDistance = lengthOf(toSparkX, toSparkY);
  const [awayX, awayY] = awayFromChasers(sim, px, py);
  const dx = toSparkX / sparkDistance + wallPush(px) + awayX;
  const dy = toSparkY / sparkDistance + wallPush(py) + awayY;
  return { command: commandToward(dx, dy), rng };
};
