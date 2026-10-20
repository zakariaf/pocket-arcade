// apps/flock-tilt/src/board/board-ids.test.ts
import { sheepEntity, TURN_ENTITY, wolfEntity } from './board-ids.ts';

describe('sheepEntity and wolfEntity', () => {
  it('gives every animal its own entity, apart from the turn entity', () => {
    const ids = [
      ...Array.from({ length: 8 }, (_, id) => sheepEntity(id)),
      ...Array.from({ length: 4 }, (_, id) => wolfEntity(id)),
    ];
    expect(new Set(ids).size).toBe(12);
    expect(ids).not.toContain(TURN_ENTITY);
  });
});
