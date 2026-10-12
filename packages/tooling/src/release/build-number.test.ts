// packages/tooling/src/release/build-number.test.ts
import { bumpBuildNumber, buildTag, releaseTag, resumableBuildNumber } from './build-number.ts';

const SOURCE = "export const gameConfig = {\n  version: '1.0.0',\n  buildNumber: 7,\n};\n";

describe('resumableBuildNumber', () => {
  const check = {
    game: 'line-siege',
    gameConfigSource: SOURCE,
    headSubject: 'chore(line-siege): build 7\n',
    tags: ['line-siege/v1.0.0+6'],
  };

  it('reuses the committed number while HEAD is its bump commit and it is untagged', () => {
    expect(resumableBuildNumber(check)).toBe(7);
  });

  it('refuses when other commits came after the bump', () => {
    expect(() => resumableBuildNumber({ ...check, headSubject: 'fix(line-siege): x' })).toThrow(
      'Run release:ios without --resume',
    );
  });

  it('refuses a number that already has a build tag', () => {
    const tags = [...check.tags, 'line-siege/v1.0.0+7'];
    expect(() => resumableBuildNumber({ ...check, tags })).toThrow('already tagged');
  });
});

describe('bumpBuildNumber', () => {
  it('increments the single buildNumber line', () => {
    const bump = bumpBuildNumber(SOURCE);
    expect(bump.next).toBe(8);
    expect(bump.text).toContain('  buildNumber: 8,\n');
  });

  it('refuses a file with no buildNumber line', () => {
    expect(() => bumpBuildNumber('export const gameConfig = {};\n')).toThrow('found 0');
  });

  it('refuses a file with two buildNumber lines', () => {
    expect(() => bumpBuildNumber(`${SOURCE}  buildNumber: 3,\n`)).toThrow('found 2');
  });
});

describe('buildTag', () => {
  it('formats the per-build git tag', () => {
    expect(buildTag('line-siege', '1.0.0', 8)).toBe('line-siege/v1.0.0+8');
  });
});

describe('releaseTag', () => {
  it('names the shipped version without a build number (the tag the owner\'s "ship" creates)', () => {
    expect(releaseTag('line-siege', '1.0.0')).toBe('line-siege/v1.0.0');
  });
});
