// apps/trail-clear/src/levels/trail-clear-describe.ts
// A level start as readable text for the data goldens: the offered tile and the bag, then the
// board, one row a line, each cell a kind code and its turns ('...' empty).
import { TUNING, knobsFor } from '@e07/trail-clear/rules/trail-clear-tuning.ts';

import type {
  PlacedTile,
  TileKind,
  TrailClearState,
} from '@e07/trail-clear/rules/trail-clear-types.ts';

const SIZE = TUNING.boardSize;

/** Two letters per kind: R road, W river (water), then e end, s straight, b bend, f fork. */
export const KIND_CODE: Readonly<Record<TileKind, string>> = {
  'road-end': 'Re',
  'road-straight': 'Rs',
  'road-bend': 'Rb',
  'river-end': 'We',
  'river-straight': 'Ws',
  'river-bend': 'Wb',
  ford: 'Fd',
  bridge: 'Br',
  'twin-bend': 'Tb',
  'road-fork': 'Rf',
};

function cellText(tile: PlacedTile | null): string {
  return tile === null ? '...' : `${KIND_CODE[tile.kind]}${String(tile.turns)}`;
}

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: TrailClearState): string {
  const offered = state.offered === null ? '-' : KIND_CODE[state.offered];
  const rows = Array.from({ length: SIZE }, (_, row) =>
    state.cells
      .slice(row * SIZE, (row + 1) * SIZE)
      .map(cellText)
      .join(' '),
  );
  return [`offered ${offered} bag ${String(knobsFor(state.difficulty).bag)}`, ...rows].join('\n');
}
