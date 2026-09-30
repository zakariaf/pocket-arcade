// apps/tap-flip/src/rules/volley.ts
import { STEP_MS } from '@e07/game-kit/timeline/fixed-step.ts';

/** A simulate-then-replay phase slipped into a "turn-based" game: it must follow the real-time rules. */
export function volley(ticks: number): number {
  let x = 0;
  for (let tick = 0; tick < ticks; tick += 1) x += STEP_MS;
  return x;
}
