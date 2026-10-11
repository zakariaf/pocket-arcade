// packages/tooling/src/e2e/junit-merge.ts
// The flows step runs S15's save benchmark flow in a Maestro call of its own (its perf-log entry is
// read right after it), so it writes two JUnit reports; reports/e2e/<game-id>/junit.xml holds both,
// as one Maestro 2.10 report: one <testsuite> whose tests= and failures= count every test case.
// Each report is read by its tags, never by fixed text: any indentation, self-closing test cases,
// and a report without its closing </testsuite> is refused with a clear error, never spliced.

/** One test case with its line's indentation and line end: self-closing, or up to </testcase>. */
const TESTCASE = /[ \t]*<testcase\b[^>]*?(?:\/>|>[\s\S]*?<\/testcase\s*>)[ \t]*\r?\n?/g;
const SUITE_OPEN = /<testsuite\b[^>]*>/;
const SUITE_CLOSE = /<\/testsuite\s*>/g;

type Suite = {
  /** The <testsuite ...> tag and where it starts. */
  readonly open: string;
  readonly openAt: number;
  /** Where the line of the last </testsuite> starts (or the tag itself, after other text). */
  readonly closeAt: number;
  readonly cases: readonly string[];
};

function suiteOf(xml: string): Suite | null {
  const open = SUITE_OPEN.exec(xml);
  const close = [...xml.matchAll(SUITE_CLOSE)].at(-1);
  if (open === null || close === undefined || close.index < open.index) return null;
  const lineStart = xml.lastIndexOf('\n', close.index - 1) + 1;
  const isOwnLine = xml.slice(lineStart, close.index).trim() === '';
  const body = xml.slice(open.index + open[0].length, close.index);
  return {
    open: open[0],
    openAt: open.index,
    closeAt: isOwnLine ? lineStart : close.index,
    cases: body.match(TESTCASE) ?? [],
  };
}

const countOf = (tag: string, name: 'tests' | 'failures'): number =>
  Number(new RegExp(`\\s${name}="(\\d+)"`).exec(tag)?.[1] ?? 0);

/** The tag with name="value", replaced in place or added before its closing '>'. */
function withCount(tag: string, name: 'tests' | 'failures', value: number): string {
  const attribute = new RegExp(`(\\s${name}=")\\d+(")`);
  return attribute.test(tag)
    ? tag.replace(attribute, `$1${String(value)}$2`)
    : tag.replace(/\s*>$/, ` ${name}="${String(value)}">`);
}

/** Appends the test cases of `extra` to the test suite of `main` and adds up its counts. */
export function mergeJunitReports(main: string, extra: string): string {
  const added = suiteOf(extra);
  if (added === null) {
    throw new Error(
      'junit merge: the benchmark report has no </testsuite>, so its case cannot join the flows report',
    );
  }
  if (main.trim() === '') return extra;
  const suite = suiteOf(main);
  if (suite === null) {
    throw new Error(
      'junit merge: the flows report has no </testsuite>, so the benchmark case cannot join it',
    );
  }
  const tests = suite.cases.length + added.cases.length;
  const failures = countOf(suite.open, 'failures') + countOf(added.open, 'failures');
  const open = withCount(withCount(suite.open, 'tests', tests), 'failures', failures);
  return [
    main.slice(0, suite.openAt),
    open,
    main.slice(suite.openAt + suite.open.length, suite.closeAt),
    added.cases.join(''),
    main.slice(suite.closeAt),
  ].join('');
}
