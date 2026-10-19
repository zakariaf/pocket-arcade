// apps/merge-siege/src/rules/slide-tiles.test.ts
// Spec 13: "Swipe to slide and merge every tile ... a tile that meets a smaller enemy smashes it."
// The design fix (design notes): ties go to the tile, a winning tile ploughs on through the next
// enemy, and a tile running into a bigger enemy is lost while the enemy stays.
import fc from 'fast-check';

import { DIRECTIONS } from './board-cells.ts';
import { boardText, parseBoard } from './board-text.ts';
import { beats, hasSlideEffect, slideTiles } from './slide-tiles.ts';

import type { Cell } from './merge-siege-types.ts';

const valueArb = fc.constantFrom(2, 4, 8, 16, 32);
const cellArb = fc.oneof(
  { weight: 3, arbitrary: fc.constant(null) },
  { weight: 2, arbitrary: valueArb.map((value) => ({ kind: 'tile' as const, value })) },
  { weight: 1, arbitrary: valueArb.map((value) => ({ kind: 'enemy' as const, value })) },
);
const boardArb = fc
  .array(cellArb, { minLength: 30, maxLength: 30 })
  .map((pieces): Cell[] =>
    pieces.map((piece, index) => (piece === null ? null : { id: index + 1, ...piece })),
  );

/** The sum of the numbers in a list of smashes or losses. */
const sumOf = (items: readonly { readonly value: number }[]): number =>
  items.reduce((sum, item) => sum + item.value, 0);

/** The text of a board written as rows (ids do not print). */
const textOf = (rows: readonly string[]): string => boardText(parseBoard(rows));

const total = (cells: readonly Cell[], kind: 'tile' | 'enemy'): number =>
  cells.reduce((sum, cell) => sum + (cell !== null && cell.kind === kind ? cell.value : 0), 0);

describe('slideTiles', () => {
  it('slides each tile as far as it goes, and merges two equal tiles once per swipe', () => {
    const before = parseBoard([
      '. . . . .',
      '. . . . .',
      '. . . . .',
      '. 2 . . .',
      '. . . . .',
      '2 2 2 2 4',
    ]);
    const { cells, steps, merges, points } = slideTiles(before, 'left');
    expect(boardText(cells)).toBe(
      textOf(['. . . . .', '. . . . .', '. . . . .', '2 . . . .', '. . . . .', '4 4 4 . .']),
    );
    expect(merges).toStrictEqual([
      { id: 3, intoId: 2, cell: 25, value: 4 },
      { id: 5, intoId: 4, cell: 26, value: 4 },
    ]);
    expect(steps).toStrictEqual([
      { id: 1, from: 16, to: 15 },
      { id: 3, from: 26, to: 25 },
      { id: 4, from: 27, to: 26 },
      { id: 5, from: 28, to: 26 },
      { id: 6, from: 29, to: 27 },
    ]);
    expect(points).toBe(8);
  });

  it('lets a tile smash a smaller enemy and plough on through the next one', () => {
    const before = parseBoard([
      '. . . . .',
      'e2 . . . .',
      '. . . . .',
      'e4 . . . .',
      '. . . . .',
      '8 . . . .',
    ]);
    const { cells, smashes, points } = slideTiles(before, 'up');
    expect(boardText(cells)).toBe(
      textOf(['8 . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .']),
    );
    expect(smashes).toStrictEqual([
      { id: 2, tileId: 3, cell: 15, value: 4 },
      { id: 1, tileId: 3, cell: 5, value: 2 },
    ]);
    expect(points).toBe(60);
  });

  it('gives a tie to the tile', () => {
    expect(beats(8, 8)).toBe(true);
    expect(beats(8, 16)).toBe(false);
    const { smashes } = slideTiles(
      parseBoard(['. . . . .', 'e8 . . . .', '. . . . .', '. . . . .', '. . . . .', '8 . . . .']),
      'up',
    );
    expect(smashes).toHaveLength(1);
  });

  it('loses a tile that runs into a bigger enemy, which stays where it is', () => {
    const before = parseBoard([
      '. . . . .',
      '. . . . .',
      'e8 . . . .',
      '. . . . .',
      '. . . . .',
      '4 . . . .',
    ]);
    const { cells, steps, losses } = slideTiles(before, 'up');
    expect(boardText(cells)).toBe(
      textOf(['. . . . .', '. . . . .', 'e8 . . . .', '. . . . .', '. . . . .', '. . . . .']),
    );
    expect(steps).toStrictEqual([{ id: 2, from: 25, to: 15 }]);
    expect(losses).toStrictEqual([{ id: 2, enemyId: 1, cell: 15, value: 4 }]);
  });

  it('stops a ploughing tile at a bigger enemy behind the smaller one, and loses it there', () => {
    const before = parseBoard([
      '. . . . .',
      'e16 . . . .',
      'e2 . . . .',
      '. . . . .',
      '. . . . .',
      '4 . . . .',
    ]);
    const { cells, smashes, losses } = slideTiles(before, 'up');
    expect(boardText(cells)).toBe(
      textOf(['. . . . .', 'e16 . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .']),
    );
    expect(smashes.map((smash) => smash.id)).toStrictEqual([2]);
    expect(losses).toStrictEqual([{ id: 3, enemyId: 1, cell: 10, value: 4 }]);
  });

  it('reports no effect when nothing can move the swiped way', () => {
    const before = parseBoard([
      'e2 . . . .',
      '. . . . .',
      '. . . . .',
      '. . . . .',
      '. . . . .',
      '2 4 . . .',
    ]);
    expect(hasSlideEffect(slideTiles(before, 'down'))).toBe(false);
    expect(hasSlideEffect(slideTiles(before, 'left'))).toBe(false);
    expect(hasSlideEffect(slideTiles(before, 'right'))).toBe(true);
  });

  describe('properties', () => {
    it('keeps its input unchanged, adds no piece and keeps every enemy it did not smash', () => {
      fc.assert(
        fc.property(boardArb, fc.constantFrom(...DIRECTIONS), (cells, direction) => {
          const frozen = JSON.stringify(cells);
          const result = slideTiles(cells, direction);
          expect(JSON.stringify(cells)).toBe(frozen);
          const smashed = sumOf(result.smashes);
          expect(total(result.cells, 'enemy')).toBe(total(cells, 'enemy') - smashed);
          const lost = sumOf(result.losses);
          expect(total(result.cells, 'tile')).toBe(total(cells, 'tile') - lost);
        }),
      );
    });
  });
});
