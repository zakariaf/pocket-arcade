// apps/line-siege/src/board/to-view.test.ts
import { create } from '@e07/line-siege/rules/create.ts';

import { lineSiegeBoard } from './line-siege-board.ts';
import { toView } from './to-view.ts';

const PERSIAN = {
  formatNumber: (value: number) =>
    String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(d))),
};

describe('toView', () => {
  it('localises health digits and flattens the tray blocks for the picture', () => {
    const state = create(1, 0);
    const view = toView(state, PERSIAN);
    expect(view.monsters.map((monster) => monster.hpText)).toStrictEqual(
      state.monsters.map((monster) => PERSIAN.formatNumber(monster.hp)),
    );
    expect(view.tray.slice(1)).toStrictEqual([
      [0, 0, 0, 1],
      [0, 0, 1, 0],
    ]);
  });

  it('shows a placed slot as an empty block', () => {
    const state = { ...create(1, 0), tray: [null, 2, 1] };
    expect(toView(state, PERSIAN).tray[0]).toStrictEqual([]);
  });

  it('keeps every heart slot of the wall, full or not', () => {
    const view = toView({ ...create(1, 0), hearts: 1 }, PERSIAN);
    expect([view.hearts, view.maxHearts]).toStrictEqual([1, 3]);
  });
});

describe('lineSiegeBoard', () => {
  it('stays unmirrored and describes the monsters and hearts for VoiceOver', () => {
    const view = toView(create(1, 0), PERSIAN);
    expect(lineSiegeBoard.isMirroredInRtl).toBe(false);
    expect(lineSiegeBoard.describe(view)).toStrictEqual({
      id: 'line-siege.board.summary',
      values: { monstersCount: 3, heartsCount: 3 },
    });
  });

  it('hints a move as its tray slot plus the board cells its block would cover', () => {
    const state = create(1, 0);
    const move = { kind: 'place-block' as const, trayIndex: 1, col: 7, row: 3 };
    // The targets follow the piece in that slot, anchored on the move's cell.
    const targets = lineSiegeBoard.targetsOfMove?.(state, move) ?? [];
    expect(targets[0]).toStrictEqual({ regionId: 'tray', col: 1, row: 0 });
    expect(targets.slice(1).every((target) => target.regionId === 'board')).toBe(true);
    expect(targets.slice(1)[0]).toStrictEqual({ regionId: 'board', col: 7, row: 3 });
  });

  it('hints nothing for a slot that is already used', () => {
    const state = { ...create(1, 0), tray: [null, null, null] };
    const move = { kind: 'place-block' as const, trayIndex: 0, col: 0, row: 0 };
    expect(lineSiegeBoard.targetsOfMove?.(state, move)).toStrictEqual([]);
  });
});
