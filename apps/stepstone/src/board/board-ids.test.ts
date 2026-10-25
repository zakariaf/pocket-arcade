// apps/stepstone/src/board/board-ids.test.ts
import { cellEntity, FROG_ENTITY, TURN_ENTITY } from './board-ids.ts';

describe('cellEntity', () => {
  it('gives every cell of the largest pond its own entity, apart from the turn and the frog', () => {
    const ids = Array.from({ length: 49 }, (_, index) => cellEntity(index));
    expect(new Set(ids).size).toBe(49);
    expect(ids).not.toContain(TURN_ENTITY);
    expect(ids).not.toContain(FROG_ENTITY);
    expect(FROG_ENTITY).not.toBe(TURN_ENTITY);
  });
});
