// packages/tooling/src/e2e/junit-merge.test.ts
// Maestro 2.10's JUnit report: one <testsuite> with tests= and failures= counts.
import { mergeJunitReports } from './junit-merge.ts';

const testcase = (name: string, status: string): string =>
  `    <testcase id="${name}" name="${name}" file="${name}.yaml" time="1.0" status="${status}">\n      <properties>\n        <property name="tags" value="smoke"/>\n      </properties>\n    </testcase>\n`;

const report = (cases: readonly string[], failures: number): string =>
  `<?xml version='1.0' encoding='UTF-8'?>\n<testsuites>\n  <testsuite name="Test Suite" device="e07-e16-e2e" tests="${String(cases.length)}" failures="${String(failures)}" time="9.0">\n${cases.join('')}  </testsuite>\n</testsuites>\n`;

describe('mergeJunitReports', () => {
  it("appends the second call's test cases to the first report and adds up the counts", () => {
    const main = report([testcase('a', 'SUCCESS'), testcase('b', 'ERROR')], 1);
    const extra = report([testcase('c', 'ERROR')], 1);
    expect(mergeJunitReports(main, extra)).toBe(
      report([testcase('a', 'SUCCESS'), testcase('b', 'ERROR'), testcase('c', 'ERROR')], 2),
    );
  });

  it('finds the end of the suite whatever its indentation, and adds the cases before it', () => {
    const flat = (cases: readonly string[], failures: number): string =>
      report(cases, failures).replace('  </testsuite>', '</testsuite>');
    const tabbed = (cases: readonly string[], failures: number): string =>
      report(cases, failures).replace('  </testsuite>', '\t</testsuite>');
    const extra = report([testcase('c', 'SUCCESS')], 0);
    expect(mergeJunitReports(flat([testcase('a', 'SUCCESS')], 0), extra)).toBe(
      flat([testcase('a', 'SUCCESS'), testcase('c', 'SUCCESS')], 0),
    );
    expect(mergeJunitReports(tabbed([testcase('a', 'ERROR')], 1), extra)).toBe(
      tabbed([testcase('a', 'ERROR'), testcase('c', 'SUCCESS')], 1),
    );
  });

  it('counts and copies self-closing test cases', () => {
    const empty = (name: string): string =>
      `    <testcase id="${name}" name="${name}" file="${name}.yaml" time="0.5" status="SUCCESS"/>\n`;
    const main = report([testcase('a', 'SUCCESS')], 0);
    expect(mergeJunitReports(main, report([empty('c'), testcase('d', 'ERROR')], 1))).toBe(
      report([testcase('a', 'SUCCESS'), empty('c'), testcase('d', 'ERROR')], 1),
    );
  });

  it('refuses a report without a closing </testsuite>, naming which one, instead of splicing it', () => {
    const cut = report([testcase('a', 'SUCCESS')], 0).replace(
      '  </testsuite>\n</testsuites>\n',
      '',
    );
    const extra = report([testcase('c', 'SUCCESS')], 0);
    expect(() => mergeJunitReports(cut, extra)).toThrow(
      'junit merge: the flows report has no </testsuite>, so the benchmark case cannot join it',
    );
    expect(() => mergeJunitReports(extra, cut)).toThrow(
      'junit merge: the benchmark report has no </testsuite>, so its case cannot join the flows report',
    );
  });

  it('keeps the second report alone when the first call wrote none', () => {
    const extra = report([testcase('c', 'SUCCESS')], 0);
    expect(mergeJunitReports('', extra)).toBe(extra);
  });
});
