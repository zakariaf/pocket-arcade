// packages/tooling/src/deps/release-age-excludes.test.ts
import { checkReleaseAgeExcludes } from './release-age-excludes.ts';

const POLICY = 'min-release-age=7\nengine-strict=true\nsave-exact=true\n';
const BLOCK = [
  '# exclude-block expires=2026-10-03 reason=bootstrap of the verified set',
  'min-release-age-exclude[]=expo',
  'min-release-age-exclude[]=@expo/*',
].join('\n');

describe('checkReleaseAgeExcludes', () => {
  it('accepts a dated block up to and including its expiry day', () => {
    const npmrc = `${POLICY}\n${BLOCK}\n`;
    expect(checkReleaseAgeExcludes(npmrc, '2026-09-26')).toStrictEqual([]);
    expect(checkReleaseAgeExcludes(npmrc, '2026-10-03')).toStrictEqual([]);
  });

  it('reports every exclude of a block once it has expired', () => {
    const violations = checkReleaseAgeExcludes(`${POLICY}\n${BLOCK}\n`, '2026-10-04');
    expect(violations.map((violation) => violation.problem)).toStrictEqual(['expired', 'expired']);
    expect(violations[0]).toStrictEqual({ line: 6, pattern: 'expo', problem: 'expired' });
  });

  it('reports an exclude that has no dated block header', () => {
    const npmrc = `${POLICY}\nmin-release-age-exclude[]=prettier\n`;
    expect(checkReleaseAgeExcludes(npmrc, '2026-09-26')).toStrictEqual([
      { line: 5, pattern: 'prettier', problem: 'no-block' },
    ]);
  });

  it('ends a block at the first blank line', () => {
    const npmrc = `${POLICY}\n${BLOCK}\n\nmin-release-age-exclude[]=knip\n`;
    expect(checkReleaseAgeExcludes(npmrc, '2026-09-26')).toStrictEqual([
      { line: 9, pattern: 'knip', problem: 'no-block' },
    ]);
  });

  it('reports a missing min-release-age=7 line', () => {
    expect(checkReleaseAgeExcludes('save-exact=true\n', '2026-09-26')).toStrictEqual([
      { line: 0, pattern: '', problem: 'policy-missing' },
    ]);
  });

  it('reports a later line that switches a policy line off (npm keeps the last value)', () => {
    const npmrc = `${POLICY}min-release-age = 0\nengine-strict=false\n`;
    expect(checkReleaseAgeExcludes(npmrc, '2026-09-26')).toStrictEqual([
      { line: 4, pattern: 'min-release-age = 0', problem: 'policy-overridden' },
      { line: 5, pattern: 'engine-strict=false', problem: 'policy-overridden' },
    ]);
  });

  it('treats every spelling npm accepts as an exclude', () => {
    const npmrc = `${POLICY}\nmin-release-age-exclude = knip\n  min-release-age-exclude[] = prettier\n`;
    expect(checkReleaseAgeExcludes(npmrc, '2026-09-26')).toStrictEqual([
      { line: 5, pattern: 'knip', problem: 'no-block' },
      { line: 6, pattern: 'prettier', problem: 'no-block' },
    ]);
  });

  it('ignores commented-out settings and placeholder headers', () => {
    const npmrc = `${POLICY}# exclude-block expires=YYYY-MM-DD reason=<link>\n# min-release-age=0\n`;
    expect(checkReleaseAgeExcludes(npmrc, '2026-09-26')).toStrictEqual([]);
  });
});
