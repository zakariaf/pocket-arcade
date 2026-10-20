// apps/jump-chain/src/board/board-ids.test.ts
import { enemyEntity, TURN_ENTITY } from './board-ids.ts';

describe('enemyEntity', () => {
  it('gives every enemy its own entity, apart from the turn entity', () => {
    const ids = Array.from({ length: 200 }, (_, id) => enemyEntity(id));
    expect(new Set(ids).size).toBe(200);
    expect(ids).not.toContain(TURN_ENTITY);
  });
});
