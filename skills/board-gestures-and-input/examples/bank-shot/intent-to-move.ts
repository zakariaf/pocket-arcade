// apps/bank-shot/src/rules/intent-to-move.ts
// Bank Shot: pull back and release; the shot goes opposite to the drag. The aim is quantised to
// integers before it enters state, so saves stay compact and replays exact.
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

export type BankShotState = { readonly ballsLeft: number };

/** Launch direction as a unit vector in thousandths (integers), y pointing down. */
export type BankShotMove = { readonly kind: 'shoot'; readonly aimX: number; readonly aimY: number };

/** Shorter pulls are treated as a slip of the finger. */
const MIN_PULL_PT = 20;
const AIM_SCALE = 1000;

/** Release vector → a shot upwards, or null. Math.sqrt is exact under IEEE 754 (deterministic). */
export function aimMove(dx: number, dy: number): BankShotMove | null {
  const pull = Math.sqrt(dx * dx + dy * dy);
  if (pull < MIN_PULL_PT) return null;
  const aimX = Math.round((-dx / pull) * AIM_SCALE) + 0;
  const aimY = Math.round((-dy / pull) * AIM_SCALE) + 0;
  return aimY < 0 ? { kind: 'shoot', aimX, aimY } : null;
}

export function intentToMove(state: BankShotState, intent: InputIntent): BankShotMove | null {
  if (state.ballsLeft === 0) return null;
  switch (intent.kind) {
    case 'aim':
      return aimMove(intent.dx, intent.dy);
    case 'tap':
    case 'long-press':
    case 'swipe':
    case 'drag-end':
      return null;
  }
}
