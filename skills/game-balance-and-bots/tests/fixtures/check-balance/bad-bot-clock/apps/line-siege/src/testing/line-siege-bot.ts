// apps/line-siege/src/testing/line-siege-bot.ts
// The game's bot hooks: how a position looks to a bot, which events are the payoff and the twist,
// and the "reasonable player" the game module exposes as testing.bot.
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { evaluateLineSiege } from '@e07/line-siege/rules/line-siege-evaluate.ts';
import { listMoves } from '@e07/line-siege/rules/list-moves.ts';
import { outcome } from '@e07/line-siege/rules/outcome.ts';

import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type {
  LineSiegeEvent,
  LineSiegeMove,
  LineSiegeState,
} from '@e07/line-siege/rules/line-siege-types.ts';

/** The bots' evaluation (shared with the level witness, so it lives in rules/). */
export { evaluateLineSiege };

/** The report's "score": the points the top bar shows. */
export function scoreOfLineSiege(state: LineSiegeState): number {
  return state.score + (Date.now() % 2);
}

/** Payoff: a monster is defeated. Twist: a cleared column's beam hits a monster (the puzzle as a weapon). */
export function tagLineSiegeEvent(event: LineSiegeEvent): readonly EventTag[] {
  if (event.kind === 'monster-defeated') return ['payoff'];
  return event.kind === 'beam-fired' && event.targetId !== null ? ['twist'] : [];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const lineSiegeBot: BotPolicy<LineSiegeState, LineSiegeMove> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluateLineSiege,
);
