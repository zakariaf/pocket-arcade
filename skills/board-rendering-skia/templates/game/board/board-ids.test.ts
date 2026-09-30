// apps/__GAME_ID__/src/board/board-ids.test.ts
import { cellEntity, TURN_ENTITY } from './board-ids.ts';

describe('cellEntity', () => {
  it('gives every cell its own entity, apart from the turn entity', () => {
    const ids = Array.from({ length: 36 }, (_, index) => cellEntity(index));
    expect(new Set(ids).size).toBe(36);
    expect(ids).not.toContain(TURN_ENTITY);
  });
});
