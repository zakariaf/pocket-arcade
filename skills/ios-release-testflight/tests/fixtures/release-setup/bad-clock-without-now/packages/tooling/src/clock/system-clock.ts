// packages/tooling/src/clock/system-clock.ts
export function todayIso(): string {
  return new Date(Date.now()).toISOString().slice(0, 10);
}
