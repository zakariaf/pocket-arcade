// apps/scrap-shove/src/rules/player-move.test.ts
import { stateFromText } from './board-text.ts';
import { playerMove } from './player-move.ts';

const FLOOR = stateFromText(['.n...', '.#...', '.@#..', '.....', '.....']);

describe('playerMove', () => {
  it('waits in place', () => {
    expect(playerMove(FLOOR, { kind: 'wait' })).toStrictEqual({
      floor: FLOOR,
      events: [{ kind: 'player-waited', at: { col: 1, row: 2 } }],
    });
  });

  it('steps to a free neighbour', () => {
    const { floor, events } = playerMove(FLOOR, { kind: 'step', col: 0, row: 3 });
    expect(floor.player).toStrictEqual({ col: 0, row: 3 });
    expect(events).toStrictEqual([
      { kind: 'player-stepped', from: { col: 1, row: 2 }, to: { col: 0, row: 3 } },
    ]);
  });

  it('shoves a heap one square further and marks it shoved (spec 13: pushed like crates)', () => {
    const { floor, events } = playerMove(FLOOR, { kind: 'shove', col: 2, row: 2 });
    expect(floor.heaps).toContainEqual({ id: 3, col: 3, row: 2, isShoved: true });
    expect(events.at(-1)).toStrictEqual({
      kind: 'scrap-shoved',
      heapId: 3,
      from: { col: 2, row: 2 },
      to: { col: 3, row: 2 },
      byRobotId: null,
    });
  });

  it('crushes the robot behind a shoved heap', () => {
    const { floor, events } = playerMove(FLOOR, { kind: 'shove', col: 1, row: 1 });
    expect(floor.robots).toStrictEqual([]);
    expect(events.map((event) => event.kind)).toStrictEqual([
      'player-stepped',
      'scrap-shoved',
      'robot-crushed',
    ]);
  });

  it('throws when the shoved square holds no heap', () => {
    expect(() => playerMove(FLOOR, { kind: 'shove', col: 0, row: 2 })).toThrow(RangeError);
  });
});
