// apps/scrap-shove/src/board/to-view.test.ts
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';

import { toView } from './to-view.ts';

const PERSIAN = {
  formatNumber: (value: number) =>
    String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(d))),
};

describe('toView', () => {
  it('keeps the floor, the player, each robot with its next step, and the heaps', () => {
    const view = toView(stateFromText(['n..f', '.#..', '..@.', 'h...']), PERSIAN);
    expect(view).toMatchObject({ cols: 4, rows: 4, player: { col: 2, row: 2 }, isCaught: false });
    expect(view.robots).toStrictEqual([
      { id: 1, kind: 'normal', col: 0, row: 0, stepCol: 1, stepRow: 1 },
      { id: 2, kind: 'fast', col: 3, row: 0, stepCol: -1, stepRow: 1 },
      { id: 4, kind: 'heavy', col: 0, row: 3, stepCol: 1, stepRow: -1 },
    ]);
    expect(view.heaps).toStrictEqual([{ id: 3, col: 1, row: 1 }]);
  });

  it('writes the crash sizes in the chosen digits, one for every robot count up to the total', () => {
    const view = toView(stateFromText(['n..f', '.#..', '..@.', 'h...']), PERSIAN);
    expect(view.countTexts).toStrictEqual(['۰', '۱', '۲', '۳']);
  });

  it('counts the robots scrapped so far for the spoken summary', () => {
    const start = stateFromText(['n.n.', '....', '....', '.@..']);
    const { state } = applyMove(start, { kind: 'wait' });
    expect(toView(state, PERSIAN)).toMatchObject({ scrapped: 2, total: 2, robots: [] });
  });

  it('marks a caught player, with no next step for the robot standing on them', () => {
    const start = stateFromText(['....', '.n..', '..@.', '....']);
    const { state } = applyMove(start, { kind: 'wait' });
    const view = toView(state, PERSIAN);
    expect(view.isCaught).toBe(true);
    expect(view.robots).toStrictEqual([
      { id: 1, kind: 'normal', col: 2, row: 2, stepCol: 0, stepRow: 0 },
    ]);
  });
});
