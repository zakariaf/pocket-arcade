// packages/shell/src/services/clock/system-clock-adapter.ts
// device-only: trivial
export function createSystemClockAdapter(): { readonly nowMs: () => number } {
  return { nowMs: () => Date.now() };
}
