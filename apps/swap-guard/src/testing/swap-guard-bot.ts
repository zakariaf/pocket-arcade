// apps/swap-guard/src/testing/swap-guard-bot.ts
// The game's bot hooks: how a position looks to a bot, which events are the payoff and the twist,
// and the "reasonable player" the game module exposes as testing.bot.
import { greedyPolicy } from '@e07/game-kit/testing/bot-policies.ts';
import { applyMove } from '@e07/swap-guard/rules/apply-move.ts';
import { oppositeOf, stepFrom } from '@e07/swap-guard/rules/board-grid.ts';
import { listMoves } from '@e07/swap-guard/rules/list-moves.ts';
import { outcome } from '@e07/swap-guard/rules/outcome.ts';
import { strikesOf, struckSquares } from '@e07/swap-guard/rules/strikes.ts';

import type { BotPolicy } from '@e07/game-kit/testing/play-bot.ts';
import type { EventTag } from '@e07/game-kit/testing/trace-bot.ts';
import type {
  SwapGuardEvent,
  SwapGuardMove,
  SwapGuardState,
} from '@e07/swap-guard/rules/swap-guard-types.ts';

/** Above any board the rules can make: a won position always outranks a playing one. */
const WON_VALUE = 100_000;
/** Each enemy already knocked out. */
const KNOCKED_OUT = 1000;
/** Each enemy standing on a struck square: the next volley takes it unless it is moved. */
const DOOMED = 300;
/** Each enemy the best safe swap from here would knock out (a player sees one swap ahead). */
const ONE_SWAP_AWAY = 200;
/** The guard standing in a strike must move next turn: a small worry. */
const GUARD_STRUCK = 50;
/** Per king step to the nearest safe square behind a spear or an archer (the self-strike setup). */
const PER_STEP = 20;

/** The most enemies one swap knocks out without the guard being hit. */
function bestSafeKnockOut(state: SwapGuardState): number {
  return listMoves(state).reduce((best, move) => {
    const next = applyMove(state, move).state;
    const count = next.isHit ? 0 : state.enemies.length - next.enemies.length;
    return Math.max(best, count);
  }, 0);
}

/** King steps from the guard to the nearest unstruck square right behind a spear or an archer. */
function stepsToSetup(state: SwapGuardState, struck: ReadonlySet<number>): number | null {
  const row = Math.floor(state.guard / state.size);
  const col = state.guard % state.size;
  const steps = state.enemies
    .filter((enemy) => enemy.kind !== 'brute')
    .map((enemy) => stepFrom(state.size, enemy.cell, oppositeOf(enemy.facing)))
    .filter((cell): cell is number => cell !== null && !struck.has(cell))
    .map((cell) =>
      Math.max(Math.abs(Math.floor(cell / state.size) - row), Math.abs((cell % state.size) - col)),
    );
  return steps.length === 0 ? null : Math.min(...steps);
}

/**
 * Higher is better for the player: a win; else enemies knocked out, enemies already standing in a
 * strike, the knock-outs one more swap can make, the guard outside every strike, and the walk to
 * the square behind an enemy, where two swaps send it into its own strike. A person reads the
 * strikes this way; a bot that only counts knock-outs wanders until its swaps run out.
 */
export function evaluateSwapGuard(state: SwapGuardState): number {
  const result = outcome(state);
  if (result.kind === 'won') return WON_VALUE + result.score;
  if (result.kind === 'lost') return -WON_VALUE;
  const struck = struckSquares(strikesOf(state));
  const doomed = state.enemies.filter((enemy) => struck.has(enemy.cell)).length;
  const steps = stepsToSetup(state, struck);
  return (
    KNOCKED_OUT * (state.enemyCount - state.enemies.length) +
    DOOMED * doomed +
    ONE_SWAP_AWAY * bestSafeKnockOut(state) -
    (struck.has(state.guard) ? GUARD_STRUCK : 0) -
    (steps === null ? 0 : PER_STEP * steps)
  );
}

/** The report's "score": the score the top bar and the result show. */
export function scoreOfSwapGuard(state: SwapGuardState): number {
  return state.score;
}

/** Payoff: an enemy knocked out. Twist: one volley knocking out two or more (a double hit). */
export function tagSwapGuardEvent(event: SwapGuardEvent): readonly EventTag[] {
  if (event.kind !== 'enemies-defeated') return [];
  return event.enemyIds.length >= 2 ? ['payoff', 'twist'] : ['payoff'];
}

/** The game module's testing.bot: the greedy "reasonable player". */
export const swapGuardBot: BotPolicy<SwapGuardState, SwapGuardMove> = greedyPolicy(
  { listMoves, applyMove, outcome },
  evaluateSwapGuard,
);
