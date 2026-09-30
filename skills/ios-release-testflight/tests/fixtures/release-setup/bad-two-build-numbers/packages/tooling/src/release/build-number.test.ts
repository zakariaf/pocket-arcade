// packages/tooling/src/release/build-number.test.ts
import { bumpBuildNumber, buildTag } from './build-number.ts';

const SOURCE = "export const gameConfig = {\n  version: '1.0.0',\n  buildNumber: 7,\n};\n";

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
