// apps/trail-clear/src/testing/trail-clear-bot.ts
// The game's bot hooks: how a position looks to a bot, which events are the payoff and the twist,
// and the "reasonable player" the game module exposes as testing.bot.
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { listMoves } from '@e07/trail-clear/rules/list-moves.ts';
import { outcome } from '@e07/trail-clear/rules/outcome.ts';
import { evaluateTrailClear } from '@e07/trail-clear/rules/trail-clear-evaluate.ts';

import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type {
  TrailClearEvent,
  TrailClearMove,
  TrailClearState,
} from '@e07/trail-clear/rules/trail-clear-types.ts';

/** The bots' evaluation (shared with the level witness, so it lives in rules/). */
export { evaluateTrailClear };

/** The report's "score": the points the top bar shows. */
export function scoreOfTrailClear(state: TrailClearState): number {
  return state.score;
}

/** Payoff: a loop is closed and wiped. Twist: one placement closes a road and a river at once. */
export function tagTrailClearEvent(event: TrailClearEvent): readonly EventTag[] {
  if (event.kind === 'loop-closed') return ['payoff'];
  return event.kind === 'double-closed' ? ['twist'] : [];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const trailClearBot: BotPolicy<TrailClearState, TrailClearMove> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluateTrailClear,
);
