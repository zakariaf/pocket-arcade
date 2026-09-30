// apps/tile-drop/src/rules/apply-move.test.ts
import { applyMove, type GameState } from './apply-move.ts';

const START: GameState = { columns: [0, 7, 3], score: 0 };

describe('applyMove', () => {
  it('places a block and scores one point', () => {
    const result = applyMove(START, { kind: 'place-block', column: 0 });

    expect(result).toStrictEqual({
      ok: true,
      value: {
        state: { columns: [1, 7, 3], score: 1 },
        events: [{ kind: 'block-placed', column: 0 }],
      },
    });
  });

  it('clears a full column and adds the bonus', () => {
    const result = applyMove(START, { kind: 'place-block', column: 1 });

    expect(result).toStrictEqual({
      ok: true,
      value: {
        state: { columns: [0, 0, 3], score: 10 },
        events: [
          { kind: 'block-placed', column: 1 },
          { kind: 'column-cleared', column: 1 },
        ],
      },
    });
  });

  it('returns column-out-of-range instead of throwing', () => {
    const result = applyMove(START, { kind: 'place-block', column: 9 });

    expect(result).toStrictEqual({ ok: false, error: { kind: 'column-out-of-range', column: 9 } });
  });

  it('keeps the input state unchanged', () => {
    applyMove(START, { kind: 'place-block', column: 2 });

    expect(START).toStrictEqual({ columns: [0, 7, 3], score: 0 });
  });
});
