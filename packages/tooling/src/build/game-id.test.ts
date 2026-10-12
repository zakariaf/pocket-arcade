// packages/tooling/src/build/game-id.test.ts
import { isGameId } from './game-id.ts';

describe('isGameId', () => {
  it('accepts a kebab-case folder under apps/ and nothing else', () => {
    expect(['line-siege', 'flock-tilt', 'a1'].map(isGameId)).toStrictEqual([true, true, true]);
    const bad = [undefined, '', 'Line-Siege', 'line_siege', '-line', 'line--siege', '../x'];
    expect(bad.map(isGameId)).toStrictEqual(bad.map(() => false));
  });
});
