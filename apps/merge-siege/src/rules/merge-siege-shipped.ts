// apps/merge-siege/src/rules/merge-siege-shipped.ts
// The proven board of every shipped level, read from the committed pack tables (data only: the
// rules import no levels code). generate-levels.ts proved each level when it wrote the pack, with
// create()'s own search: the first board of the seed's stream the witness wins, or the fallback
// seed's when it won none (spec 8.1 and 15.7). That board's try is kept here, so create() draws it
// again without running the witness. create.test.ts proves every shipped level still gets exactly
// the board the search finds, and the levels contract test replays every witness line.
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import pack1 from '@e07/merge-siege/levels/pack-1.json' with { type: 'json' };
import pack2 from '@e07/merge-siege/levels/pack-2.json' with { type: 'json' };
import pack3 from '@e07/merge-siege/levels/pack-3.json' with { type: 'json' };

const keyOf = (seed: number, difficulty: number): string => `${String(seed)}:${String(difficulty)}`;

/**
 * A proof other than the level's own first board: the try (2nd, 3rd, ...) of its own stream the
 * witness first won, or, when it lost every try, the fallback seed's try create() handed out.
 */
type LaterProof = number | { readonly fallbackTry: number };

/** The shipped levels whose first board the witness lost, by seed and difficulty. */
const LATER_PROOFS: Readonly<Record<string, LaterProof>> = {
  '1819644377:11': 2, // level 11
  '4194166893:25': 5, // level 24
  '3651827656:28': 2, // level 27
  '739839551:33': 2, // level 31
  '4013759342:34': 3, // level 32
  '1568413096:41': 4, // level 38
  '105888232:44': 2, // level 41
  '2685710886:46': 2, // level 43
  '3966516369:50': 2, // level 46
  '3384964566:54': 3, // level 50
  '3494913213:55': 2, // level 51
  '2952573976:56': 2, // level 52
  '647928583:57': 3, // level 53
  '776949562:58': 3, // level 54
  '1957770252:61': 4, // level 56
  '3250488158:63': 4, // level 58
  '2823552997:64': 3, // level 59
  '534403157:65': 2, // level 60
  '940549966:66': 2, // level 61
  '4109029535:67': 4, // level 62
  '4266242864:68': 3, // level 63
  '1663683289:70': 5, // level 64
  '2090618450:71': 4, // level 65
  '3808322948:73': 5, // level 67
  '1205763373:74': 3, // level 68
  '1095814726:75': { fallbackTry: 1 }, // level 69
  '2551533364:76': 7, // level 70
  '854617218:78': 6, // level 72
  '427682057:80': 7, // level 73
  '2873028303:82': 6, // level 75
  '1851980798:83': 4, // level 76
  '1425045637:84': 9, // level 77
  '2706798124:85': { fallbackTry: 1 }, // level 78
  '399489707:86': 10, // level 79
  '4115736699:87': 8, // level 80
  '4254721532:88': 5, // level 81
  '2667754033:90': 4, // level 82
  '3094689194:91': 4, // level 83
  '818132983:92': 2, // level 84
  '975346312:93': 13, // level 85
  '1407736902:95': 16, // level 87
  '3423588131:96': 8, // level 88
  '4120245124:97': 15, // level 89
  '1858687962:99': 6, // level 90
};

const SHIPPED = new Set(
  [pack1, pack2, pack3].flatMap((pack) =>
    toLevelEntries(pack).map((entry) => keyOf(entry.seed, entry.difficulty)),
  ),
);

/** The board that proved a shipped level: the try of its own seed's stream or the fallback's. */
export type ShippedBoard = { readonly isFallback: boolean; readonly tries: number };

/**
 * The proven board of this shipped level (tries 1 = the stream's first board), or null when no
 * pack ships this seed at this difficulty (the daily, any other seed: create() searches those).
 */
export function shippedBoard(seed: number, difficulty: number): ShippedBoard | null {
  const key = keyOf(seed, difficulty);
  if (!SHIPPED.has(key)) return null;
  const proof = LATER_PROOFS[key] ?? 1;
  return typeof proof === 'number'
    ? { isFallback: false, tries: proof }
    : { isFallback: true, tries: proof.fallbackTry };
}
