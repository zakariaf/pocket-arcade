// apps/scrap-shove/src/rules/robots-turn.test.ts
import { applyMove } from './apply-move.ts';
import { boardText, stateFromText } from './board-text.ts';
import { stepOrder } from './robots-turn.ts';

import type { ScrapShoveResult } from './scrap-shove-types.ts';

const WAIT = { kind: 'wait' } as const;

function waitOn(lines: readonly string[]): ScrapShoveResult {
  return applyMove(stateFromText(lines), WAIT);
}

describe('the robots turn (spec 13: every robot steps toward the player)', () => {
  it('moves a normal robot one king step toward the player', () => {
    const { state, events } = waitOn(['n....', '.....', '..@..', '.....', '.....']);
    expect(state.robots).toStrictEqual([{ id: 1, kind: 'normal', col: 1, row: 1 }]);
    expect(events).toStrictEqual([
      { kind: 'player-waited', at: { col: 2, row: 2 } },
      {
        kind: 'robots-stepped',
        steps: [
          { robotId: 1, robotKind: 'normal', from: { col: 0, row: 0 }, to: { col: 1, row: 1 } },
        ],
      },
    ]);
  });

  it('moves a fast robot twice, in a second robots-stepped event', () => {
    const { state, events } = waitOn(['f....', '.....', '.....', '.....', '....@']);
    expect(state.robots).toStrictEqual([{ id: 1, kind: 'fast', col: 2, row: 2 }]);
    expect(events.slice(1)).toStrictEqual([
      {
        kind: 'robots-stepped',
        steps: [
          { robotId: 1, robotKind: 'fast', from: { col: 0, row: 0 }, to: { col: 1, row: 1 } },
        ],
      },
      {
        kind: 'robots-stepped',
        steps: [
          { robotId: 1, robotKind: 'fast', from: { col: 1, row: 1 }, to: { col: 2, row: 2 } },
        ],
      },
    ]);
  });

  it('crashes two robots that step onto one square into a new heap (spec 13: crashes turn robots into scrap)', () => {
    const { state, events } = waitOn(['n.n.', '....', '....', '.@..']);
    expect(state.robots).toStrictEqual([]);
    expect(state.heaps).toStrictEqual([{ id: 3, col: 1, row: 1, isShoved: false }]);
    expect(events.slice(2)).toStrictEqual([
      {
        kind: 'robots-crashed',
        robotIds: [1, 2],
        at: { col: 1, row: 1 },
        cause: 'robot',
        heapId: 3,
        isShovedScrap: false,
      },
      { kind: 'floor-cleared' },
    ]);
  });

  it('wrecks a robot that steps onto scrap, leaving the heap', () => {
    const { state, events } = waitOn(['n...', '.#..', '....', '...@']);
    expect(state.robots).toStrictEqual([]);
    expect(state.heaps).toStrictEqual([{ id: 2, col: 1, row: 1, isShoved: false }]);
    expect(events[2]).toStrictEqual({
      kind: 'robots-crashed',
      robotIds: [1],
      at: { col: 1, row: 1 },
      cause: 'scrap',
      heapId: 2,
      isShovedScrap: false,
    });
  });

  it('lets a heavy robot shove scrap ahead of it instead of wrecking (the design fix)', () => {
    const { state, events } = waitOn(['.....', '.h...', '..#..', '.....', '....@']);
    expect(boardText(state, 5)).toBe(['.....', '.....', '..h..', '...#.', '....@'].join('\n'));
    expect(events.slice(1)).toStrictEqual([
      {
        kind: 'robots-stepped',
        steps: [
          { robotId: 1, robotKind: 'heavy', from: { col: 1, row: 1 }, to: { col: 2, row: 2 } },
        ],
      },
      {
        kind: 'scrap-shoved',
        heapId: 2,
        from: { col: 2, row: 2 },
        to: { col: 3, row: 3 },
        byRobotId: 1,
      },
    ]);
  });

  it("keeps the player's shove mark on scrap a heavy robot pushes, so a wreck on it is still the twist", () => {
    const { state, events } = waitOn([
      '.......',
      '.......',
      '.......',
      '..h*..@',
      '.......',
      '..f....',
      '.......',
    ]);
    expect(state.heaps).toStrictEqual([{ id: 2, col: 4, row: 3, isShoved: true }]);
    expect(events).toContainEqual({
      kind: 'robots-crashed',
      robotIds: [3],
      at: { col: 4, row: 3 },
      cause: 'scrap',
      heapId: 2,
      isShovedScrap: true,
    });
  });

  it('smashes the heap a heavy robot cannot shove (the player, the wall or another heap behind it), and the robot stays put', () => {
    const toPlayer = waitOn(['.....', '.....', '..h..', '...#.', '....@']);
    expect(boardText(toPlayer.state, 5)).toBe(
      ['.....', '.....', '..h..', '.....', '....@'].join('\n'),
    );
    expect(toPlayer.events.at(-1)).toStrictEqual({
      kind: 'scrap-smashed',
      heapId: 2,
      at: { col: 3, row: 3 },
      byRobotId: 1,
    });
    const toWall = waitOn(['.#...@', 'h.....', '......', '......', '......', '......']);
    expect(toWall.state.robots).toStrictEqual([{ id: 2, kind: 'heavy', col: 0, row: 1 }]);
    expect(toWall.state.heaps).toStrictEqual([]);
    const toHeap = waitOn(['......', '......', '..h##@', '......', '......', '......']);
    expect(toHeap.state.robots).toStrictEqual([{ id: 1, kind: 'heavy', col: 2, row: 2 }]);
    expect(toHeap.state.heaps).toStrictEqual([{ id: 3, col: 4, row: 2, isShoved: false }]);
  });

  it('crushes a robot behind the heap a heavy robot shoves', () => {
    const { state, events } = waitOn(['.....', '.n...', 'h#..@', '.....', '.....']);
    expect(state.robots).toStrictEqual([{ id: 2, kind: 'heavy', col: 1, row: 2 }]);
    expect(events.slice(2)).toStrictEqual([
      {
        kind: 'scrap-shoved',
        heapId: 3,
        from: { col: 1, row: 2 },
        to: { col: 2, row: 2 },
        byRobotId: 2,
      },
      {
        kind: 'robot-crushed',
        robotId: 1,
        robotKind: 'normal',
        at: { col: 2, row: 2 },
        heapId: 3,
        isByPlayer: false,
      },
    ]);
  });

  it('breaks a robot that runs into a heavy robot on its own square, and the heavy one survives', () => {
    const { state, events } = waitOn(['......', '......', '.nh##@', '......', '......', '......']);
    expect(state.robots).toStrictEqual([{ id: 2, kind: 'heavy', col: 2, row: 2 }]);
    expect(state.heaps.at(-1)).toStrictEqual({ id: 5, col: 1, row: 2, isShoved: false });
    expect(events.at(-1)).toStrictEqual({
      kind: 'robots-crashed',
      robotIds: [1],
      at: { col: 1, row: 2 },
      cause: 'heavy',
      heapId: 5,
      isShovedScrap: false,
    });
  });

  it('breaks the robot a heavy robot runs into, where that robot stands', () => {
    const { state, events } = waitOn(['.....', '.n...', '.h..@', '.....', '.....']);
    expect(state.robots).toStrictEqual([{ id: 2, kind: 'heavy', col: 1, row: 2 }]);
    expect(state.heaps).toStrictEqual([{ id: 3, col: 2, row: 2, isShoved: false }]);
    expect(events.at(-1)).toMatchObject({ kind: 'robots-crashed', robotIds: [1], cause: 'heavy' });
  });

  it('stops the second of two heavy robots heading for one square', () => {
    const { state } = waitOn(['.....', '.h...', '.h..@', '.....', '.....']);
    expect(state.robots).toStrictEqual([
      { id: 1, kind: 'heavy', col: 2, row: 2 },
      { id: 2, kind: 'heavy', col: 1, row: 2 },
    ]);
  });

  it('ends the turn when a robot reaches the player (spec S7: a robot caught you)', () => {
    const start = stateFromText(['n...', '.n..', '..@.', '....']);
    const { state, events } = applyMove(start, WAIT);
    expect(state.caughtBy).toBe(2);
    expect(state.robots).toStrictEqual([
      { id: 1, kind: 'normal', col: 0, row: 0 },
      { id: 2, kind: 'normal', col: 2, row: 2 },
    ]);
    expect(events.slice(1)).toStrictEqual([
      {
        kind: 'robots-stepped',
        steps: [
          { robotId: 2, robotKind: 'normal', from: { col: 1, row: 1 }, to: { col: 2, row: 2 } },
        ],
      },
      { kind: 'player-caught', robotId: 2, at: { col: 2, row: 2 } },
    ]);
    const { player, robots, heaps, nextId } = start;
    expect(state.rescue).toStrictEqual({ player, robots, heaps, nextId });
  });
});

describe('stepOrder', () => {
  it('orders the moving robots nearest to the player first, ties by id', () => {
    const state = stateFromText(['f...n', '.....', '..@..', '.....', 'h..n.']);
    expect(stepOrder(state, () => true)).toStrictEqual([1, 2, 3, 4]);
    const nearer = stateFromText(['.....', '....n', '.....', '..@..', '.n...']);
    expect(stepOrder(nearer, () => true)).toStrictEqual([2, 1]);
    expect(stepOrder(state, (robot) => robot.kind === 'fast')).toStrictEqual([1]);
  });
});
