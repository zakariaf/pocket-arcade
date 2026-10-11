// packages/tooling/src/e2e/junit-merge.ts
// The flows step runs S15's save benchmark flow in a Maestro call of its own (its perf-log entry is
// read right after it), so it writes two JUnit reports; reports/e2e/<game-id>/junit.xml holds both,
// as one Maestro 2.10 report: one <testsuite> whose tests= and failures= count every test case.

const TESTCASE = /^ *<testcase\b[\s\S]*?<\/testcase>\n/gm;

const countOf = (xml: string, name: 'tests' | 'failures'): number =>
  Number(new RegExp(`<testsuite\\b[^>]*\\s${name}="(\\d+)"`).exec(xml)?.[1] ?? 0);

/** Appends the test cases of `extra` to the test suite of `main` and adds up its counts. */
export function mergeJunitReports(main: string, extra: string): string {
  if (!main.includes('</testsuite>')) return extra;
  const cases = extra.match(TESTCASE) ?? [];
  const counted = main
    .replace(/(<testsuite\b[^>]*\stests=")(\d+)/, (_all, head: string, tests: string) =>
      [head, String(Number(tests) + cases.length)].join(''),
    )
    .replace(/(<testsuite\b[^>]*\sfailures=")(\d+)/, (_all, head: string) =>
      [head, String(countOf(main, 'failures') + countOf(extra, 'failures'))].join(''),
    );
  const end = counted.lastIndexOf('  </testsuite>');
  return `${counted.slice(0, end)}${cases.join('')}${counted.slice(end)}`;
}
