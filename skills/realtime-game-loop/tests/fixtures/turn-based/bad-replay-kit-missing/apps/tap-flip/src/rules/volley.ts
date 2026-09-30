// apps/tap-flip/src/rules/volley.ts
import { STEP_MS } from '@e07/game-kit/timeline/fixed-step.ts';

/** Timed events and a hard cap, but the loop kit it imports was never copied. */
export function volley(maxTicks: number): { readonly atMs: number } {
  return { atMs: Math.round(maxTicks * STEP_MS) };
}
