// apps/__GAME_ID__/src/testing/__GAME_ID__-bot.ts
// The game's bot hooks: how a position looks to a bot, which events are the payoff and the twist,
// and the "reasonable player" the game module exposes as testing.bot. The template game is Tap
// Flip: a press flips a cell and its neighbours, and a dark board wins.
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/__GAME_ID__/rules/apply-move.ts';
import { neighbourhood } from '@e07/__GAME_ID__/rules/flip-cells.ts';
import { listMoves } from '@e07/__GAME_ID__/rules/list-moves.ts';
import { outcome } from '@e07/__GAME_ID__/rules/outcome.ts';

import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type {
  __GAME_PASCAL__Event,
  __GAME_PASCAL__Move,
  __GAME_PASCAL__State,
} from '@e07/__GAME_ID__/rules/__GAME_ID__-types.ts';

/** Above any board the rules can make: a won position always outranks a playing one. */
const WON_VALUE = 1000;
/** What a board one press from dark is worth over its lit cells (a player sees the cross). */
const ONE_PRESS_BONUS = 5;
/** A press this big (away from the corners) shows the twist: the neighbours flip too. */
const TWIST_CELLS = 4;

/** True when the lit cells are exactly one press's cross: a player presses its centre and wins. */
function isOnePressFromDark(state: __GAME_PASCAL__State, lit: number): boolean {
  return state.cells.some((_, index) => {
    const cross = neighbourhood(state.cols, state.rows, index);
    return cross.length === lit && cross.every((cell) => state.cells[cell] === 1);
  });
}

/**
 * Higher is better for the player: a win (more spare moves first), else fewer lit cells, with a
 * bonus for a board a player can finish with one press. Plain "fewest lit cells" wins only about
 * half of the easiest levels (it walks away from the finishing cross), which no person would.
 */
export function evaluate__GAME_PASCAL__(state: __GAME_PASCAL__State): number {
  const result = outcome(state);
  if (result.kind === 'won') return WON_VALUE + result.score;
  if (result.kind === 'lost') return -WON_VALUE;
  const lit = state.cells.filter((cell) => cell === 1).length;
  return isOnePressFromDark(state, lit) ? ONE_PRESS_BONUS - lit : -lit;
}

/** The report's "score": the win's score the result screen shows (spare moves), 0 otherwise. */
export function scoreOf__GAME_PASCAL__(state: __GAME_PASCAL__State): number {
  const result = outcome(state);
  return result.kind === 'won' ? result.score : 0;
}

/** Payoff: the board goes dark. Twist: a press that flips its neighbours too (four or five cells). */
export function tag__GAME_PASCAL__Event(event: __GAME_PASCAL__Event): readonly EventTag[] {
  if (event.kind === 'board-cleared') return ['payoff'];
  return event.kind === 'cells-flipped' && event.cells.length >= TWIST_CELLS ? ['twist'] : [];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const __GAME_CAMEL__Bot: BotPolicy<__GAME_PASCAL__State, __GAME_PASCAL__Move> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluate__GAME_PASCAL__,
);
