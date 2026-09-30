// packages/game-kit/src/dates/daily-seed.ts
import type { DateKey } from './date-key.ts';

/**
 * Spec 8.3: same local date + same game salt -> same uint32 seed on every phone.
 * FNV-1a over the key, mixed with the salt (Math.imul only). Goldens pin outputs:
 * changing this function breaks every player's daily streak comparison.
 */
export function dailySeed(date: DateKey, salt: number): number {
  let hash = (0x811c9dc5 ^ salt) >>> 0;
  for (let index = 0; index < date.length; index += 1) {
    hash = Math.imul(hash ^ date.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash;
}
