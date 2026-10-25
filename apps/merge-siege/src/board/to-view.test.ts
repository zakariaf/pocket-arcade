// apps/merge-siege/src/board/to-view.test.ts
// The view is a pure function of the state (board-rendering-skia rule 5: the view is always the
// final state); numbers on the board follow the chosen digits (spec 7.3), so they are localised here.
import { parseBoard } from '@e07/merge-siege/rules/board-text.ts';
import { create } from '@e07/merge-siege/rules/create.ts';

import { digitsOf } from './board-ids.ts';
import { toView } from './to-view.ts';

const LATIN = { formatNumber: (value: number): string => String(value) };
const PERSIAN = {
  formatNumber: (value: number): string =>
    String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] ?? d),
};

describe('toView', () => {
  it('lists every piece with its kind, number and cell, in reading order', () => {
    const state = {
      ...create(1, 0),
      cells: parseBoard([
        '. e4 . . .',
        '. . . . .',
        '. . . . .',
        '. . . . .',
        '. . . . .',
        '8 . . . 2',
      ]),
    };
    expect(toView(state, LATIN).pieces).toStrictEqual([
      { id: 1, kind: 1, value: 4, col: 1, row: 0 },
      { id: 2, kind: 0, value: 8, col: 0, row: 5 },
      { id: 3, kind: 0, value: 2, col: 4, row: 5 },
    ]);
  });

  it('carries the board size and the enemy waiting to enter, or none', () => {
    const view = toView(create(1, 0), LATIN);
    expect(view).toMatchObject({ cols: 5, rows: 6, next: { col: 4, value: 4 } });
    expect(toView({ ...create(1, 0), next: null }, LATIN).next).toBeNull();
  });

  it('localises every number a piece can show, in the chosen digits', () => {
    const view = toView(create(1, 0), PERSIAN);
    expect(view.digits[1]).toBe('۲');
    expect(view.digits[10]).toBe('۱۰۲۴');
    expect(digitsOf(view, 16)).toBe('۱۶');
  });

  it('is a pure function: the same state gives the same view', () => {
    expect(toView(create(5, 40), LATIN)).toStrictEqual(toView(create(5, 40), LATIN));
  });
});
