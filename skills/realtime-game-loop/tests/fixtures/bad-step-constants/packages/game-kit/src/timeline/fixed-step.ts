// packages/game-kit/src/timeline/fixed-step.ts
'worklet';

/** One simulation tick. The simulation never sees frame time, only tick counts. */
export const STEP_MS = 1000 / 60;
/** Longest frame gap we catch up on (backgrounding, ads, a GC pause): 250 ms. */
export const MAX_FRAME_MS = 250;

/** How many ticks to run this frame and the time left over for the next one. */
export type StepPlan = { readonly steps: number; readonly accMs: number };

/**
 * Accumulator for a fixed-step loop. `frameDtMs` is FrameInfo.timeSincePreviousFrame,
 * which is null on the first frame after (re)activation: that frame simulates nothing.
 */
export function planSteps(accMs: number, frameDtMs: number | null): StepPlan {
  const dt = frameDtMs === null ? 0 : Math.min(Math.max(frameDtMs, 0), MAX_FRAME_MS);
  let acc = accMs + dt;
  let steps = 0;
  while (acc >= STEP_MS) {
    acc -= STEP_MS;
    steps += 1;
  }
  return { steps, accMs: acc };
}
