// apps/trail-clear/src/rules/opening.ts
// The opening, generated from the seed (game-balance-and-bots: an early payoff by design): a road
// end and a river end face one empty inner cell from opposite sides, and the first tile dealt is
// the ford, so a reasonable first placement closes both loops at once (the payoff and the twist).
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import { neighbourOf, oppositeOf } from './board-cells.ts';
import { TUNING } from './trail-clear-tuning.ts';

import type { PlacedTile, TileKind } from './trail-clear-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

const SIZE = TUNING.boardSize;
/** The inner cells (not on the rim): every side of them is another cell. */
const INNER = SIZE - 2;

/** The opening's empty cell, the side its road end sits on, and the first tile dealt. */
export type Opening = {
  readonly gap: number;
  readonly roadSide: number;
  readonly firstTile: TileKind;
};

/** Draws the opening's gap (an inner cell) and the side of its road end. */
export function drawOpening(rng: RngState): { readonly opening: Opening; readonly rng: RngState } {
  const spot = nextInt(rng, INNER * INNER);
  const side = nextInt(spot.state, 4);
  const gap = (1 + Math.floor(spot.value / INNER)) * SIZE + 1 + (spot.value % INNER);
  return { opening: { gap, roadSide: side.value, firstTile: 'ford' }, rng: side.state };
}

/** The opening board: the road end and the river end facing the gap, every other cell empty. */
export function openingCells(opening: Opening): (PlacedTile | null)[] {
  const roadCell = neighbourOf(opening.gap, opening.roadSide);
  const riverCell = neighbourOf(opening.gap, oppositeOf(opening.roadSide));
  // A road end's road is its north edge in turn 0; turned t times it faces side t.
  const roadEnd: PlacedTile = {
    kind: 'road-end',
    turns: oppositeOf(opening.roadSide),
    placedAt: 0,
  };
  const riverEnd: PlacedTile = { kind: 'river-end', turns: opening.roadSide, placedAt: 0 };
  return Array.from({ length: SIZE * SIZE }, (_, cell) => {
    if (cell === roadCell) return roadEnd;
    return cell === riverCell ? riverEnd : null;
  });
}
