// apps/snare-snake/src/board/board-ids.test.ts
import fc from 'fast-check';

import { cellEntity, cellOfEntity, critterEntity, HEAD_ENTITY, TURN_ENTITY } from './board-ids.ts';

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

  it('turns a cell entity back into its cell, so draw can walk only the cells with a track', () => {
    expect(cellOfEntity(1005)).toBe(5);
    fc.assert(fc.property(fc.nat({ max: 999 }), (cell) => cellOfEntity(cellEntity(cell)) === cell));
  });
});
