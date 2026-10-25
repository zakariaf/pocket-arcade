// apps/jump-chain/src/rules/ranks.ts
// One enemy rank: the dark squares of one row, each filled at the row's chance (`fill` percent),
// never empty (an empty draw puts one enemy on a seeded square). Drawn from the seeded RNG only.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import { darkColumns } from './board-squares.ts';

import type { Enemy } from './jump-chain-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** What a new rank needs: the RNG to draw from, its id, its row, its fill and its first enemy id. */
export type RankRequest = {
  readonly rng: RngState;
  readonly rank: number;
  readonly row: number;
  readonly fill: number;
  readonly firstId: number;
};

/** A new rank, left to right, with the RNG state to draw from next. */
export function makeRank(request: RankRequest): {
  readonly enemies: Enemy[];
  readonly rng: RngState;
} {
  const columns = darkColumns(request.row);
  let rng = request.rng;
  const picked: number[] = [];
  for (const col of columns) {
    const draw = nextInt(rng, 100);
    rng = draw.state;
    if (draw.value < request.fill) picked.push(col);
  }
  if (picked.length === 0) {
    const draw = nextInt(rng, columns.length);
    rng = draw.state;
    picked.push(pickAt(columns, draw.value));
  }
  const enemies = picked.map((col, index) => ({
    id: request.firstId + index,
    rank: request.rank,
    col,
    row: request.row,
  }));
  return { enemies, rng };
}
