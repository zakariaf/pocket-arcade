// packages/shell/src/services/clock/day-key.ts
export const dayKey = (nowMs: number): number => Math.floor(nowMs / 86_400_000);
