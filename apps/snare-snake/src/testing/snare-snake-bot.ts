// apps/snare-snake/src/testing/snare-snake-bot.ts
// The game's bot hooks: how a position looks to a bot, which events are the payoff and the twist,
// and the "reasonable player" the game module exposes as testing.bot.
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/snare-snake/rules/apply-move.ts';
import { listMoves } from '@e07/snare-snake/rules/list-moves.ts';
import { outcome } from '@e07/snare-snake/rules/outcome.ts';
import { evaluateSnareSnake } from '@e07/snare-snake/rules/snare-snake-evaluate.ts';

import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type {
  SnareSnakeEvent,
  SnareSnakeMove,
  SnareSnakeState,
} from '@e07/snare-snake/rules/snare-snake-types.ts';

/** The bots' evaluation (shared with the level witness, so it lives in rules/). */
export { evaluateSnareSnake };

/** The report's "score": the points the top bar and the result show. */
export function scoreOfSnareSnake(state: SnareSnakeState): number {
  return state.score;
}

/**
 * Payoff: critters caught (the first win moment). Twist: one loop catches more than one critter
 * (design notes, Bands: the reason to plan a bigger loop).
 */
export function tagSnareSnakeEvent(event: SnareSnakeEvent): readonly EventTag[] {
  if (event.kind !== 'critters-caught') return [];
  return event.count > 1 ? ['payoff', 'twist'] : ['payoff'];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const snareSnakeBot: BotPolicy<SnareSnakeState, SnareSnakeMove> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluateSnareSnake,
);
