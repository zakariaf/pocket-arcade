// apps/trail-clear/src/board/board-ids.test.ts
import { cellEntity, loopEntity, slotEntity, TURN_ENTITY } from './board-ids.ts';

describe('board ids', () => {
  it('gives every cell, tray slot and closed loop its own entity, apart from the turn entity', () => {
    const cells = Array.from({ length: 25 }, (_, index) => cellEntity(index));
    const others = [slotEntity(0), slotEntity(3), loopEntity(0), loopEntity(1)];
    const ids = [...cells, ...others];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(TURN_ENTITY);
  });

  it('numbers the entities in their own ranges', () => {
    expect([cellEntity(0), cellEntity(24), slotEntity(2), loopEntity(1)]).toStrictEqual([
      1000, 1024, 102, 11,
    ]);
  });
});
