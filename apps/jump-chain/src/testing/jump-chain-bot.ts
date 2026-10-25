// apps/jump-chain/src/testing/jump-chain-bot.ts
// The game's bot hooks: how a position looks to a bot, which events are the payoff and the twist,
// and the "reasonable player" the game module exposes as testing.bot.
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { evaluateJumpChain } from '@e07/jump-chain/rules/jump-chain-evaluate.ts';
import { listMoves } from '@e07/jump-chain/rules/list-moves.ts';
import { outcome } from '@e07/jump-chain/rules/outcome.ts';

import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type {
  JumpChainEvent,
  JumpChainMove,
  JumpChainState,
} from '@e07/jump-chain/rules/jump-chain-types.ts';

/** The bots' evaluation (shared with the level witness, so it lives in rules/). */
export { evaluateJumpChain };

/** The report's "score": the points the top bar and the result show. */
export function scoreOfJumpChain(state: JumpChainState): number {
  return state.score;
}

/** Payoff: enemies captured. Twist: a chain of two or more jumps (spec 13: only multi-jump chains clear them). */
export function tagJumpChainEvent(event: JumpChainEvent): readonly EventTag[] {
  if (event.kind !== 'enemies-captured') return [];
  return event.chain >= 2 ? ['payoff', 'twist'] : ['payoff'];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const jumpChainBot: BotPolicy<JumpChainState, JumpChainMove> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluateJumpChain,
);
