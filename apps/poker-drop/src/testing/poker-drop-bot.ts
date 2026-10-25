// apps/poker-drop/src/testing/poker-drop-bot.ts
// Poker Drop's bot hooks: how a position looks to a bot, which events are the payoff and the twist,
// and the "reasonable player" the game module exposes as testing.bot. The evaluation lives in
// rules/poker-drop-evaluate.ts (the level witness plays with it too; levels may not import testing).
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/poker-drop/rules/apply-move.ts';
import { listMoves } from '@e07/poker-drop/rules/list-moves.ts';
import { outcome } from '@e07/poker-drop/rules/outcome.ts';
import { evaluatePokerDrop } from '@e07/poker-drop/rules/poker-drop-evaluate.ts';

import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type {
  PokerDropEvent,
  PokerDropMove,
  PokerDropState,
} from '@e07/poker-drop/rules/poker-drop-types.ts';

export { evaluatePokerDrop } from '@e07/poker-drop/rules/poker-drop-evaluate.ts';

/** The report's "score": the points the top bar and the result show. */
export function scoreOfPokerDrop(state: PokerDropState): number {
  return state.score;
}

/** Payoff: a hand bursts. Twist: a cascade, a hand made by the cards that fell (step 2 or more). */
export function tagPokerDropEvent(event: PokerDropEvent): readonly EventTag[] {
  if (event.kind !== 'hand-burst') return [];
  return event.step >= 2 ? ['payoff', 'twist'] : ['payoff'];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const pokerDropBot: BotPolicy<PokerDropState, PokerDropMove> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluatePokerDrop,
);
