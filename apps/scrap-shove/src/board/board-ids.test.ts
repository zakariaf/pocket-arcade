// apps/scrap-shove/src/board/board-ids.test.ts
import {
  crashEntity,
  heapEntity,
  kindAt,
  kindIndex,
  PLAYER_ENTITY,
  ROBOT_KIND_NAMES,
  robotEntity,
  TURN_ENTITY,
} from './board-ids.ts';

describe('board entities', () => {
  it('gives every robot, heap and crash its own entity, apart from the turn and the player', () => {
    const ids = Array.from({ length: 900 }, (_, id) => id);
    const entities = [
      ...ids.map(robotEntity),
      ...ids.map(heapEntity),
      ...ids.map(crashEntity),
      TURN_ENTITY,
      PLAYER_ENTITY,
    ];
    expect(new Set(entities).size).toBe(entities.length);
  });
});

describe('robot kinds as track values', () => {
  it('turns each kind into a number and back', () => {
    expect(ROBOT_KIND_NAMES.map((kind) => kindAt(kindIndex(kind)))).toStrictEqual([
      'normal',
      'fast',
      'heavy',
    ]);
  });

  it('rounds a value between kinds to the nearest kind and clamps one outside them', () => {
    expect([-0.4, 0.6, 1.4, 1.6, 2.9].map(kindAt)).toStrictEqual([
      'normal',
      'fast',
      'fast',
      'heavy',
      'heavy',
    ]);
  });
});
