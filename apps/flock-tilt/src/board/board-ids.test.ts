// apps/flock-tilt/src/board/board-ids.test.ts
import { TILT_KEY_IDS } from '@e07/flock-tilt/rules/intent-to-move.ts';

import { sheepEntity, TILT_KEY_REGIONS, TURN_ENTITY, wolfEntity } from './board-ids.ts';

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

describe('TILT_KEY_REGIONS', () => {
  it('uses the same region ids as intentToMove, so a tapped key tilts its own way', () => {
    expect(TILT_KEY_REGIONS).toStrictEqual(TILT_KEY_IDS);
  });
});
