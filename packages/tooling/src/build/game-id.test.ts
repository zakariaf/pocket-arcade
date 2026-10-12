// packages/tooling/src/build/game-id.test.ts
import { isAppId, isGameId } from './game-id.ts';

describe('isGameId', () => {
  it('accepts a kebab-case folder under apps/ and nothing else', () => {
    expect(['line-siege', 'flock-tilt', 'a1'].map(isGameId)).toStrictEqual([true, true, true]);
    const bad = [undefined, '', 'Line-Siege', 'line_siege', '-line', 'line--siege', '../x'];
    expect(bad.map(isGameId)).toStrictEqual(bad.map(() => false));
  });
});

describe('isAppId (owner decision O4)', () => {
  it('accepts io.applander.<game id without hyphens> and nothing else', () => {
    expect(['io.applander.linesiege', 'io.applander.flocktilt'].map(isAppId)).toStrictEqual([
      true,
      true,
    ]);
    const bad = [
      undefined,
      '',
      'io.applander.line-siege',
      'io.applander.LineSiege',
      'com.example.linesiege',
      'io.applander.linesiege.premium',
      'io.applander.linesiege&filter[name]=x',
    ];
    expect(bad.map(isAppId)).toStrictEqual(bad.map(() => false));
  });
});
