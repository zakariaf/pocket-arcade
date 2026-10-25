// apps/poker-drop/src/rules/poker-drop-shipped.ts
// The (seed, difficulty) of every shipped level, read from the committed pack tables (data only:
// the rules import no levels code; the levels import the rules). Each one was proven winnable by
// the witness when generate-levels.ts wrote it (spec 15.7; the levels contract test replays every
// witness line), so create() hands out its own board without a second search.
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import pack1 from '@e07/poker-drop/levels/pack-1.json' with { type: 'json' };
import pack2 from '@e07/poker-drop/levels/pack-2.json' with { type: 'json' };
import pack3 from '@e07/poker-drop/levels/pack-3.json' with { type: 'json' };

const keyOf = (seed: number, difficulty: number): string => `${String(seed)}:${String(difficulty)}`;

const SHIPPED = new Set(
  [pack1, pack2, pack3].flatMap((pack) =>
    toLevelEntries(pack).map((entry) => keyOf(entry.seed, entry.difficulty)),
  ),
);

/** True when a shipped level starts from exactly this seed and difficulty. */
export function isShippedLevel(seed: number, difficulty: number): boolean {
  return SHIPPED.has(keyOf(seed, difficulty));
}
