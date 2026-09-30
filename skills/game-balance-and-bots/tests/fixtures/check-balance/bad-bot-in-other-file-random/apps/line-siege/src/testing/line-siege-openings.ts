// apps/line-siege/src/testing/line-siege-openings.ts
/** Picks a scripted opening for the bot. */
export function pickOpening(count: number): number {
  return Math.floor(Math.random() * count);
}
