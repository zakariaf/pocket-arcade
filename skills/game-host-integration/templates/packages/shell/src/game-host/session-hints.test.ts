// packages/shell/src/game-host/session-hints.test.ts
import { hintSearchOf } from './session-hints.ts';

describe('hintSearchOf (spec 8.5: "The game\'s solver suggests the next good move")', () => {
  it('searches once per position and again when the position changes', () => {
    const asked: number[] = [];
    const search = hintSearchOf<number, string>({
      kind: 'solver',
      suggest: (state) => {
        asked.push(state);
        return state > 1 ? null : `move-${String(state)}`;
      },
    });
    const hints = [search(0, 0), search(0, 0), search(1, 1), search(2, 2), search(2, 2)];
    expect(hints).toStrictEqual(['move-0', 'move-0', 'move-1', null, null]);
    expect(asked).toStrictEqual([0, 1, 2]);
  });

  it('gives no hint for a game without solver hints', () => {
    expect(hintSearchOf<number, string>({ kind: 'none' })(0, 0)).toBeNull();
  });
});
