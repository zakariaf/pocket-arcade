// apps/stepstone/src/rules/stepstone-tuning.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { MOVE_KINDS } from './hops.ts';
import { TUNING, knobsFor } from './stepstone-tuning.ts';

import type { DifficultyKnobs } from './stepstone-tuning.ts';

const ROWS: readonly DifficultyKnobs[] = TUNING.levelRows;

describe('knobsFor', () => {
  it('maps the level scale 0..99 onto four rows in equal bands, easiest first', () => {
    const rows = [0, 24, 25, 49, 50, 74, 75, 99].map((difficulty) =>
      ROWS.indexOf(knobsFor(difficulty)),
    );
    expect(rows).toStrictEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('clamps difficulties outside the scale to the first and the last row', () => {
    expect(knobsFor(-5)).toStrictEqual(TUNING.levelRows[0]);
    expect(knobsFor(ENDLESS_DIFFICULTY)).toStrictEqual(TUNING.levelRows.at(-1));
  });

  it('makes every row at least as hard as the one before', () => {
    TUNING.levelRows.forEach((row, index) => {
      const previous = TUNING.levelRows[index - 1] ?? row;
      expect(row.side).toBeGreaterThanOrEqual(previous.side);
      expect(row.kinds.length).toBeGreaterThanOrEqual(previous.kinds.length);
      expect(row.routeHops).toBeGreaterThanOrEqual(previous.routeHops);
      expect(row.decoys).toBeGreaterThanOrEqual(previous.decoys);
      expect(row.minPar).toBeGreaterThanOrEqual(previous.minPar);
    });
  });

  it('caps the hop kinds at the four glyphs v1 draws', () => {
    for (const row of TUNING.levelRows) {
      expect(row.kinds.length).toBeLessThanOrEqual(MOVE_KINDS.length);
      expect(MOVE_KINDS).toStrictEqual(expect.arrayContaining([...row.kinds]));
    }
  });

  it('keeps the pinned rows (a changed row changes every level of its band)', () => {
    expect(TUNING.levelRows).toStrictEqual(GOLDEN_LEVEL_ROWS);
  });
});

const GOLDEN_LEVEL_ROWS = [
  { side: 5, kinds: ['rook', 'king'], routeHops: 4, decoys: 4, minPar: 3 },
  { side: 5, kinds: ['rook', 'king', 'bishop'], routeHops: 5, decoys: 5, minPar: 4 },
  { side: 6, kinds: ['rook', 'king', 'bishop', 'knight'], routeHops: 6, decoys: 7, minPar: 5 },
  { side: 7, kinds: ['rook', 'king', 'bishop', 'knight'], routeHops: 7, decoys: 9, minPar: 6 },
];
