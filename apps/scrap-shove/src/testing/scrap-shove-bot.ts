// apps/scrap-shove/src/testing/scrap-shove-bot.ts
// The game's bot hooks: how a floor looks to a reasonable player, which events are the payoff (a
// robot scrapped) and the twist (a shoved heap blocks or crushes a robot), and the greedy player
// the game module exposes as testing.bot.
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import {
  beyond,
  distanceBetween,
  heapAt,
  isSameCell,
  stepToward,
} from '@e07/scrap-shove/rules/floor-squares.ts';
import { listMoves } from '@e07/scrap-shove/rules/list-moves.ts';
import { outcome, robotsScrapped } from '@e07/scrap-shove/rules/outcome.ts';
import { TUNING } from '@e07/scrap-shove/rules/scrap-shove-tuning.ts';

import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type {
  Robot,
  ScrapShoveEvent,
  ScrapShoveMove,
  ScrapShoveState,
} from '@e07/scrap-shove/rules/scrap-shove-types.ts';

/** Above any floor the rules can make: a won floor always outranks a playing one. */
const WON_VALUE = 100_000;
/** What one robot still on the floor costs. */
const ROBOT_COST = 100;
/** Worth of breathing room: the nearest robot needs this many turns or more to reach the player. */
const SAFE_VALUE = 30;
/** Worth of a robot two turns away. */
const CLOSE_VALUE = 15;
/** Cost of a robot that reaches the player next turn unless the player gets away. */
const DANGER_COST = 60;
/** Worth of a normal or fast robot about to step onto scrap. */
const DOOMED_VALUE = 20;
/** Worth of a heavy robot lined up behind a heap next to the player: one shove crushes it. */
const CRUSH_READY_VALUE = 40;
/** Cost per square between the player and a heavy robot (a person lures heavy robots in). */
const HEAVY_DISTANCE_COST = 3;

/** Turns a robot needs to reach the player: fast robots close two squares a turn. */
function turnsToReach(robot: Robot, state: ScrapShoveState): number {
  const distance = distanceBetween(robot, state.player);
  return robot.kind === 'fast' ? Math.floor((distance + 1) / 2) : distance;
}

function safetyOf(state: ScrapShoveState): number {
  const nearest = Math.min(...state.robots.map((robot) => turnsToReach(robot, state)));
  if (nearest >= 3) return SAFE_VALUE;
  return nearest === 2 ? CLOSE_VALUE : -DANGER_COST;
}

/** True when the robot's next step lands on scrap (a normal or fast robot is then wrecked). */
function isDoomed(robot: Robot, state: ScrapShoveState): boolean {
  return robot.kind !== 'heavy' && heapAt(state, stepToward(robot, state.player)) !== null;
}

/** True when a heavy robot stands behind a heap next to the player, in one line: a shove crushes it. */
function isCrushReady(robot: Robot, state: ScrapShoveState): boolean {
  const between = stepToward(robot, state.player);
  return heapAt(state, between) !== null && isSameCell(beyond(robot, between), state.player);
}

function robotValue(robot: Robot, state: ScrapShoveState): number {
  if (robot.kind !== 'heavy') return isDoomed(robot, state) ? DOOMED_VALUE : 0;
  const lure = -HEAVY_DISTANCE_COST * distanceBetween(robot, state.player);
  return isCrushReady(robot, state) ? CRUSH_READY_VALUE + lure : lure;
}

/**
 * Higher is better for the player: a cleared floor, else fewer robots, room to breathe, robots
 * about to wreck on scrap and heavy robots lined up behind a heap, as a person reads the arrows.
 */
export function evaluateScrapShove(state: ScrapShoveState): number {
  const result = outcome(state);
  if (result.kind === 'won') return WON_VALUE;
  if (result.kind === 'lost') return -WON_VALUE;
  const robots = state.robots.reduce((sum, robot) => sum + robotValue(robot, state), 0);
  return -ROBOT_COST * state.robots.length + safetyOf(state) + robots;
}

/** The report's "score": the score the top bar and the result show (10 per robot scrapped). */
export function scoreOfScrapShove(state: ScrapShoveState): number {
  return robotsScrapped(state) * TUNING.pointsPerRobot;
}

/** Payoff: a robot scrapped. Twist: a heap the player shoved crushes a robot or wrecks one. */
export function tagScrapShoveEvent(event: ScrapShoveEvent): readonly EventTag[] {
  if (event.kind === 'robot-crushed') return event.isByPlayer ? ['payoff', 'twist'] : ['payoff'];
  if (event.kind !== 'robots-crashed') return [];
  return event.isShovedScrap ? ['payoff', 'twist'] : ['payoff'];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const scrapShoveBot: BotPolicy<ScrapShoveState, ScrapShoveMove> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluateScrapShove,
);
