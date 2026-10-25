// apps/scrap-shove/src/rules/board-text.test.ts
import { boardText, stateFromText } from './board-text.ts';

const PICTURE = ['n..#', '.@..', '..*.', 'f..h'];

describe('stateFromText', () => {
  it('reads the player, the three robot kinds and both heap kinds, ids in reading order', () => {
    const state = stateFromText(PICTURE);
    expect(state.player).toStrictEqual({ col: 1, row: 1 });
    expect(state.robots).toStrictEqual([
      { id: 1, kind: 'normal', col: 0, row: 0 },
      { id: 4, kind: 'fast', col: 0, row: 3 },
      { id: 5, kind: 'heavy', col: 3, row: 3 },
    ]);
    expect(state.heaps).toStrictEqual([
      { id: 2, col: 3, row: 0, isShoved: false },
      { id: 3, col: 2, row: 2, isShoved: true },
    ]);
    expect(state).toMatchObject({ cols: 4, rows: 4, nextId: 6, robotsTotal: 3, caughtBy: null });
    expect(state).toMatchObject({ rescue: null, hasContinued: false });
  });

  it('refuses a picture that is not square, has no player or an unknown letter', () => {
    expect(() => stateFromText(['@..', '...'])).toThrow(RangeError);
    expect(() => stateFromText(['..', '..'])).toThrow('no player');
    expect(() => stateFromText(['@?', '..'])).toThrow('unknown floor letter');
  });
});

describe('boardText', () => {
  it('writes a playing floor back to the same picture', () => {
    expect(boardText(stateFromText(PICTURE), 4)).toBe(PICTURE.join('\n'));
  });

  it('marks a robot standing on the player with X', () => {
    const state = stateFromText(['n.', '.@']);
    const caught = { ...state, robots: [{ id: 1, kind: 'normal' as const, col: 1, row: 1 }] };
    expect(boardText(caught, 2)).toBe(['..', '.X'].join('\n'));
  });
});
