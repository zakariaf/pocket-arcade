// packages/tooling/src/release-android/version-code.test.ts
import { assertUnusedVersionCode, buildNumbersOfTags, nextVersionCode } from './version-code.ts';

const TAGS = [
  'line-siege/v1.0.0+5',
  'line-siege/v1.0.0+7',
  'line-siege/v1.0.0',
  'flock-tilt/v1.0.0+12',
  'line-siege/v1.0.1+9',
];

describe('buildNumbersOfTags', () => {
  it("reads only this game's upload tags, never its release tags", () => {
    expect(buildNumbersOfTags(TAGS, 'line-siege')).toStrictEqual([5, 7, 9]);
  });

  it('is empty for a game without uploads', () => {
    expect(buildNumbersOfTags(TAGS, 'halo-drift')).toStrictEqual([]);
  });
});

describe('nextVersionCode', () => {
  it('is the last build number plus 1, iOS and Android sharing one sequence', () => {
    expect(nextVersionCode({ game: 'line-siege', configBuildNumber: 9, tags: TAGS })).toBe(10);
  });

  it('skips every tagged number when game.config.ts is behind the tags', () => {
    expect(nextVersionCode({ game: 'line-siege', configBuildNumber: 4, tags: TAGS })).toBe(10);
  });

  it('skips a number spent by a committed bump without an upload', () => {
    expect(nextVersionCode({ game: 'line-siege', configBuildNumber: 12, tags: TAGS })).toBe(13);
  });

  it('starts after 1 for a game that has no tag yet', () => {
    expect(nextVersionCode({ game: 'halo-drift', configBuildNumber: 1, tags: TAGS })).toBe(2);
  });
});

describe('assertUnusedVersionCode', () => {
  it('accepts a number above every upload tag of the game', () => {
    expect(() => {
      assertUnusedVersionCode(10, 'line-siege', TAGS);
    }).not.toThrow();
  });

  it('refuses a number an upload tag already carries, or one below it', () => {
    expect(() => {
      assertUnusedVersionCode(9, 'line-siege', TAGS);
    }).toThrow('versionCode 9 is not above line-siege/v1.0.1+9');
  });
});
