// apps/toggle-drop/src/testing/toggle-drop-bot.ts
// The game's bot hooks: how a position looks to a bot, which events are the payoff and the twist,
// and the "reasonable player" the game module exposes as testing.bot.
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { listMoves } from '@e07/toggle-drop/rules/list-moves.ts';
import { outcome } from '@e07/toggle-drop/rules/outcome.ts';
import { evaluateToggleDrop } from '@e07/toggle-drop/rules/toggle-drop-evaluate.ts';

import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type {
  ToggleDropEvent,
  ToggleDropMove,
  ToggleDropState,
} from '@e07/toggle-drop/rules/toggle-drop-types.ts';

export { evaluateToggleDrop };

/** The report's "score": the win's score the result screen shows (balls left over), 0 otherwise. */
export function scoreOfToggleDrop(state: ToggleDropState): number {
  const result = outcome(state);
  return result.kind === 'won' ? result.score : 0;
}

/**
 * Payoff: a cup fills. Twist: a switch an earlier ball flipped sends a later ball into a cup (the
 * flip-flop idea of the game: what one ball does changes where the next one goes).
 */
export function tagToggleDropEvent(event: ToggleDropEvent): readonly EventTag[] {
  if (event.kind === 'cup-filled') return ['payoff'];
  return event.kind === 'ball-landed' && event.isInCup && event.wasRedirected ? ['twist'] : [];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const toggleDropBot: BotPolicy<ToggleDropState, ToggleDropMove> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluateToggleDrop,
);
