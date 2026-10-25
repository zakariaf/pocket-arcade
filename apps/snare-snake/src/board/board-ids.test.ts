// apps/snare-snake/src/board/board-ids.test.ts
import { cellEntity, critterEntity, HEAD_ENTITY, TURN_ENTITY } from './board-ids.ts';

describe('board ids', () => {
  it('keeps the turn, the head, the cells and the critters apart', () => {
    const ids = [
      TURN_ENTITY,
      HEAD_ENTITY,
      cellEntity(0),
      cellEntity(79),
      critterEntity(0),
      critterEntity(6),
    ];
    expect(ids).toStrictEqual([0, 1, 1000, 1079, 2000, 2006]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
