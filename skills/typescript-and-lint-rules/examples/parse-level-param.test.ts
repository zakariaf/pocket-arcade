// packages/shell/src/screens/debug/parse-level-param.test.ts
import { parseLevelParam } from './parse-level-param.ts';

describe('parseLevelParam', () => {
  it('returns the level for a whole number inside the game', () => {
    expect(parseLevelParam('12', 90)).toStrictEqual({ ok: true, value: 12 });
  });

  it('returns not-a-number instead of throwing', () => {
    expect(parseLevelParam('12a', 90)).toStrictEqual({
      ok: false,
      error: { kind: 'not-a-number', raw: '12a' },
    });
  });

  it('returns out-of-range for a level the game does not ship', () => {
    expect(parseLevelParam('91', 90)).toStrictEqual({
      ok: false,
      error: { kind: 'out-of-range', level: 91, levelCount: 90 },
    });
    expect(parseLevelParam('0', 90)).toMatchObject({ ok: false, error: { kind: 'out-of-range' } });
  });
});
