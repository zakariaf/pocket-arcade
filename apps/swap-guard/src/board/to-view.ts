// apps/swap-guard/src/board/to-view.ts
// JS thread, pure: the final state of a move in the shape draw() reads. Digits are localised here
// (spec 7.3); the board itself never mirrors (spec 7.5).
import { FACINGS, stepFrom } from '@e07/swap-guard/rules/board-grid.ts';
import { strikesOf } from '@e07/swap-guard/rules/strikes.ts';

import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';
import type { Enemy, Facing, SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';

/** One struck square of the telegraph and the way its strike goes (the arrow drawn on it). */
export type StrikeMark = { readonly cell: number; readonly facing: Facing };

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type SwapGuardView = {
  readonly size: number;
  readonly guard: number;
  readonly enemies: readonly Enemy[];
  /** The enemies the last swap knocked out, where they stood: they fall while the move plays. */
  readonly fallen: readonly Enemy[];
  /** Every square the next volley strikes, one mark per strike that reaches it, by square. */
  readonly marks: readonly StrikeMark[];
  /** Swaps left, digits already localised (the swaps badge shows it). */
  readonly swapsLeftText: string;
  readonly swapsLeft: number;
  readonly maxSwaps: number;
  /** The numbers of the spoken summary. */
  readonly defeated: number;
  readonly total: number;
  readonly isHit: boolean;
};

/** The way a strike goes into `cell`: a spear's or archer's facing, a brute's side. */
function facingInto(size: number, enemy: Enemy, cell: number): Facing {
  if (enemy.kind !== 'brute') return enemy.facing;
  return FACINGS.find((facing) => stepFrom(size, enemy.cell, facing) === cell) ?? enemy.facing;
}

/** The telegraph: every strike's squares with their direction, sorted by square. */
function marksOf(state: SwapGuardState): StrikeMark[] {
  const byId = new Map(state.enemies.map((enemy) => [enemy.id, enemy]));
  const marks = strikesOf(state).flatMap((strike) => {
    const enemy = byId.get(strike.enemyId);
    if (enemy === undefined) return [];
    return strike.cells.map((cell) => ({ cell, facing: facingInto(state.size, enemy, cell) }));
  });
  return marks.sort((a, b) => a.cell - b.cell);
}

export function toView(state: SwapGuardState, format: ViewFormat): SwapGuardView {
  const swapsLeft = Math.max(0, state.maxSwaps - state.swaps);
  return {
    size: state.size,
    guard: state.guard,
    enemies: state.enemies,
    fallen: state.lastSwap === null ? [] : state.lastSwap.defeated,
    marks: marksOf(state),
    swapsLeftText: format.formatNumber(swapsLeft),
    swapsLeft,
    maxSwaps: state.maxSwaps,
    defeated: state.enemyCount - state.enemies.length,
    total: state.enemyCount,
    isHit: state.isHit,
  };
}
