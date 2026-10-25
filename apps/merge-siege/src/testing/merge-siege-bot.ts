// apps/merge-siege/src/testing/merge-siege-bot.ts
// The game's bot hooks: how a position looks to a bot, which events are the payoff and the twist,
// and the "reasonable player" the game module exposes as testing.bot (game-balance-and-bots).
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/merge-siege/rules/apply-move.ts';
import { listMoves } from '@e07/merge-siege/rules/list-moves.ts';
import { evaluateMergeSiege } from '@e07/merge-siege/rules/merge-siege-evaluate.ts';
import { outcome } from '@e07/merge-siege/rules/outcome.ts';

import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type {
  MergeSiegeEvent,
  MergeSiegeMove,
  MergeSiegeState,
} from '@e07/merge-siege/rules/merge-siege-types.ts';

/** The bots' evaluation (shared with the level witness, so it lives in rules/). */
export { evaluateMergeSiege };

/** One swipe smashing at least this many enemies at once is the twist (the design fix's plough). */
const TWIST_SMASHES = 2;

/** The report's "score": the points the top bar and the result show. */
export function scoreOfMergeSiege(state: MergeSiegeState): number {
  return state.score;
}

/** Payoff: an enemy is smashed. Twist: two or more smashed by one swipe's slide, march or gate. */
export function tagMergeSiegeEvent(event: MergeSiegeEvent): readonly EventTag[] {
  if (event.kind !== 'enemies-smashed') return [];
  return event.smashes.length >= TWIST_SMASHES ? ['payoff', 'twist'] : ['payoff'];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const mergeSiegeBot: BotPolicy<MergeSiegeState, MergeSiegeMove> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluateMergeSiege,
);
