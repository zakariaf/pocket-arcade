// packages/shell/src/screens/daily/next-in.ts
export function minutesToMidnight(nowMs: number): number {
  return Math.ceil((86_400_000 - (nowMs % 86_400_000)) / 60_000);
}
