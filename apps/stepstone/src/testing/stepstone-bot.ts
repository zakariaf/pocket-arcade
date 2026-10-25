// apps/stepstone/src/testing/stepstone-bot.ts
// Stepstone's bot hooks: how a pond looks to a bot, which events are the payoff and the twist, and
// the "reasonable player" the game module exposes as testing.bot.
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/stepstone/rules/apply-move.ts';
import { targetsOf } from '@e07/stepstone/rules/hops.ts';
import { listMoves } from '@e07/stepstone/rules/list-moves.ts';
import { outcome } from '@e07/stepstone/rules/outcome.ts';

import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type {
  StepstoneEvent,
  StepstoneMove,
  StepstoneState,
} from '@e07/stepstone/rules/stepstone-types.ts';

/** Above any pond the rules can make: a won position always outranks a playing one. */
const WON_VALUE = 1000;
/** One square closer to the flag is worth this many stones in reach. */
const STEP_VALUE = 2;

/** King steps from the frog to the flag: how far the flag looks, whatever the hops. */
export function stepsToFlag(state: StepstoneState): number {
  const flag = state.cells.indexOf('flag');
  const rows = Math.abs(Math.floor(flag / state.side) - Math.floor(state.frog / state.side));
  const cols = Math.abs((flag % state.side) - (state.frog % state.side));
  return Math.max(rows, cols);
}

/**
 * Higher is better for the player: a win (fewer hops first), else a frog closer to the flag by eye
 * with more stones in reach. Not the solver's exact hop count: with it, one hop of lookahead would
 * already play perfectly, and a person judges "closer" by looking at the pond.
 */
export function evaluateStepstone(state: StepstoneState): number {
  const result = outcome(state);
  if (result.kind === 'won') return WON_VALUE - result.score;
  if (result.kind === 'lost') return -WON_VALUE;
  return targetsOf(state).length - STEP_VALUE * stepsToFlag(state);
}

/** The report's "score": the hops the top bar and the result show. */
export function scoreOfStepstone(state: StepstoneState): number {
  return state.moves;
}

/**
 * Payoff: the flag, or a hop kind the frog has not stood on yet this run. Twist: a hop kind chained
 * into another (the stone the frog lands on sets the next hop).
 */
export function tagStepstoneEvent(event: StepstoneEvent): readonly EventTag[] {
  if (event.kind === 'goal-reached') return ['payoff'];
  if (event.kind !== 'move-kind-changed') return [];
  return event.isNewKind ? ['payoff', 'twist'] : ['twist'];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const stepstoneBot: BotPolicy<StepstoneState, StepstoneMove> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluateStepstone,
);
