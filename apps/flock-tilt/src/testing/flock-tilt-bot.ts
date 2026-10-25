// apps/flock-tilt/src/testing/flock-tilt-bot.ts
// The game's bot hooks: how a field looks to a bot, which events are the payoff and the twist,
// and the "reasonable player" the game module exposes as testing.bot. A person looks at the
// field and tilts so that sheep line up with the pen and stay clear of the wolf.
import { applyMove } from '@e07/flock-tilt/rules/apply-move.ts';
import { listMoves } from '@e07/flock-tilt/rules/list-moves.ts';
import { outcome, runScore } from '@e07/flock-tilt/rules/outcome.ts';
import { isBesideWolf } from '@e07/flock-tilt/rules/tilt-field.ts';
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';

import type {
  FlockTiltEvent,
  FlockTiltMove,
  FlockTiltState,
  Sheep,
} from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';

/** Above any field the rules can make: a won field always outranks a playing one. */
const WON_VALUE = 100_000;
/** What one sheep still outside the pen costs (the main thing a person counts). */
const SHEEP_OUTSIDE = 100;
/** What a sheep standing beside a wolf costs: one careless tilt and it is lost. */
const BESIDE_WOLF = 40;
/** Distance cost of a sheep on an open line to the pen: one tilt could drop it in. */
const ON_OPEN_LINE = 1;
/** Added to the distance of a sheep that is not on an open line to the pen. */
const OFF_LINE = 3;

function colOf(state: FlockTiltState, cell: number): number {
  return cell % state.cols;
}

function rowOf(state: FlockTiltState, cell: number): number {
  return Math.floor(cell / state.cols);
}

/** True when the sheep shares a row or column with the pen and no rock stands between them. */
export function isOnOpenLine(state: FlockTiltState, cell: number): boolean {
  const [col, row] = [colOf(state, cell), rowOf(state, cell)];
  const [penCol, penRow] = [colOf(state, state.pen), rowOf(state, state.pen)];
  if (col !== penCol && row !== penRow) return false;
  const low = Math.min(cell, state.pen);
  const high = Math.max(cell, state.pen);
  const stride = row === penRow ? 1 : state.cols;
  return !state.rocks.some((rock) => rock > low && rock < high && (rock - low) % stride === 0);
}

/** How far one sheep on the field is from the pen, as a person reads it. */
function sheepCost(state: FlockTiltState, sheep: Sheep): number {
  const distance =
    Math.abs(colOf(state, sheep.cell) - colOf(state, state.pen)) +
    Math.abs(rowOf(state, sheep.cell) - rowOf(state, state.pen));
  const lineCost = isOnOpenLine(state, sheep.cell) ? ON_OPEN_LINE : OFF_LINE + distance;
  return SHEEP_OUTSIDE + lineCost + (isBesideWolf(state, sheep.cell) ? BESIDE_WOLF : 0);
}

/**
 * Higher is better for the player: a win (more spare tilts first), else fewer sheep outside the
 * pen, sheep lined up with the pen along open lines, and no sheep beside a wolf.
 */
export function evaluateFlockTilt(state: FlockTiltState): number {
  const result = outcome(state);
  if (result.kind === 'won') return WON_VALUE + result.score;
  if (result.kind === 'lost') return -WON_VALUE;
  const onField = state.sheep.filter((sheep) => sheep.status === 'field');
  return -onField.reduce((total, sheep) => total + sheepCost(state, sheep), 0);
}

/** The report's "score": the number the top bar and the result show. */
export function scoreOfFlockTilt(state: FlockTiltState): number {
  return runScore(state);
}

/** Payoff: a sheep drops into the pen. Twist: a sheep slides into another sheep or the wolf. */
export function tagFlockTiltEvent(event: FlockTiltEvent): readonly EventTag[] {
  if (event.kind === 'sheep-penned') return ['payoff'];
  if (event.kind !== 'animals-slid') return [];
  const isTwist = event.slides.some(
    (slide) =>
      slide.animal === 'sheep' && (slide.stoppedBy === 'sheep' || slide.stoppedBy === 'wolf'),
  );
  return isTwist ? ['twist'] : [];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const flockTiltBot: BotPolicy<FlockTiltState, FlockTiltMove> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluateFlockTilt,
);
