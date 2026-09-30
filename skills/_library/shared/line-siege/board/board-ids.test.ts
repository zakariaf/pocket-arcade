// apps/line-siege/src/board/board-ids.test.ts
import { cellEntity, heartEntity, kindAt, kindIndex, TURN_ENTITY } from './board-ids.ts';

describe('board ids', () => {
  it('gives every board cell and heart its own entity, apart from lanes, monsters and the turn', () => {
    const cells = [cellEntity(0, 0), cellEntity(7, 7)];
    const hearts = [heartEntity(0), heartEntity(2)];
    expect([...cells, ...hearts]).toStrictEqual([1000, 1707, 900, 902]);
    expect([...cells, ...hearts]).not.toContain(TURN_ENTITY);
  });

  it('maps monster kinds through their track index and draws unknown ones as normal', () => {
    expect(kindAt(kindIndex('fast'))).toBe('fast');
    expect(kindAt(9)).toBe('normal');
  });
});
