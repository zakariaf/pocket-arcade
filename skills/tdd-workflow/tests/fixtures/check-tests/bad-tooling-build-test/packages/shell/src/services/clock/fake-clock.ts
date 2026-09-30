// packages/shell/src/services/clock/fake-clock.ts
export function createFakeClock(nowMs: number): { readonly nowMs: () => number } {
  return { nowMs: () => nowMs };
}
