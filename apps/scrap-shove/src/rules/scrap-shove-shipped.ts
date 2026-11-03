// apps/scrap-shove/src/rules/scrap-shove-shipped.ts
// The proven floor of every shipped level, read from the committed pack tables (data only: the
// rules import no levels code). generate-levels.ts proved each level when it wrote the pack, with
// create()'s own search: the first layout of the seed's stream the solver proves winnable (spec
// 8.1 and 15.7). That layout's try is kept here, so create() lays it out again without the solver.
// create.test.ts proves every shipped level still gets exactly the floor the search finds, and the
// levels contract test solves every level again at its par.
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import pack1 from '@e07/scrap-shove/levels/pack-1.json' with { type: 'json' };
import pack2 from '@e07/scrap-shove/levels/pack-2.json' with { type: 'json' };
import pack3 from '@e07/scrap-shove/levels/pack-3.json' with { type: 'json' };

const keyOf = (seed: number, difficulty: number): string => `${String(seed)}:${String(difficulty)}`;

/**
 * The shipped levels whose first layout the solver could not prove, by seed and difficulty: the
 * try (2nd, 3rd, ...) whose layout it first proved. Every other shipped level is its first layout.
 */
const LATER_TRIES: Readonly<Record<string, number>> = {
  '1818429083:10': 2, // level 10
  '1119175403:26': 2, // level 25
  '981770334:43': 2, // level 40
  '3828754964:50': 3, // level 46
  '4150548789:56': 2, // level 52
  '3060975355:66': 2, // level 61
  '2039927850:67': 3, // level 62
  '352975558:72': 2, // level 66
  '462924205:73': 2, // level 67
  '3516298584:80': 2, // level 73
  '2361721675:83': 2, // level 76
  '2521494860:84': 2, // level 77
  '4265027570:87': 2, // level 80
  '991107779:91': 2, // level 83
  '641420490:96': 5, // level 88
};

const SHIPPED = new Set(
  [pack1, pack2, pack3].flatMap((pack) =>
    toLevelEntries(pack).map((entry) => keyOf(entry.seed, entry.difficulty)),
  ),
);

/**
 * The try of the seed's stream whose layout proved this shipped level (1 = its first layout), or
 * null when no pack ships this seed at this difficulty (the daily, any other seed: create()
 * searches those).
 */
export function shippedTry(seed: number, difficulty: number): number | null {
  const key = keyOf(seed, difficulty);
  return SHIPPED.has(key) ? (LATER_TRIES[key] ?? 1) : null;
}
