// apps/toggle-drop/src/board/board-ids.test.ts
import { CELL_UNITS } from '@e07/toggle-drop/rules/simulate-drop.ts';

import { BALL_ENTITY, BOARD_UNITS, cupEntity, switchEntity } from './board-ids.ts';

describe('board ids', () => {
  it('uses the board units the rules simulate the fall in', () => {
    expect(BOARD_UNITS).toBe(CELL_UNITS);
  });

  it('gives every switch, cup and the ball its own entity on the biggest board', () => {
    const switches = Array.from({ length: 9 * 9 }, (_, index) =>
      switchEntity(Math.floor(index / 9), index % 9),
    );
    const cups = Array.from({ length: 9 }, (_, col) => cupEntity(col));
    const all = [BALL_ENTITY, ...switches, ...cups];
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps the pinned entity of a switch (the timeline and draw must agree)', () => {
    expect([switchEntity(0, 0), switchEntity(2, 3), cupEntity(4)]).toStrictEqual([
      1000, 1035, 3004,
    ]);
  });
});
