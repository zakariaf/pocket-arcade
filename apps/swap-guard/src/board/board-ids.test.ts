// apps/swap-guard/src/board/board-ids.test.ts
import { cellEntity, enemyEntity, GUARD_ENTITY, TURN_ENTITY } from './board-ids.ts';

describe('board ids', () => {
  it('keeps the turn, the guard, the squares and the enemies apart', () => {
    const ids = [
      TURN_ENTITY,
      GUARD_ENTITY,
      cellEntity(0),
      cellEntity(35),
      enemyEntity(0),
      enemyEntity(5),
    ];
    expect(ids).toStrictEqual([0, 1, 1000, 1035, 2000, 2005]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
