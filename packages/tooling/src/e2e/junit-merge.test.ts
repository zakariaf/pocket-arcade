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

  it('keeps the second report alone when the first call wrote none', () => {
    const extra = report([testcase('c', 'SUCCESS')], 0);
    expect(mergeJunitReports('', extra)).toBe(extra);
  });
});
