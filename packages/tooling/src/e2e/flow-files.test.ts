// packages/tooling/src/e2e/flow-files.test.ts
// Runs on a temporary reports folder; the flow lists are read from this repo's own flows.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { allFlows, largeTextFlows, mergeJunitInto, reportArgs } from './flow-files.ts';

const report = (cases: readonly string[]): string =>
  `<?xml version='1.0' encoding='UTF-8'?>\n<testsuites>\n  <testsuite name="Test Suite" tests="${String(cases.length)}" failures="0" time="1.0">\n${cases.map((name) => `    <testcase id="${name}" name="${name}" status="SUCCESS"/>\n`).join('')}  </testsuite>\n</testsuites>\n`;

describe('reportArgs', () => {
  it("writes Maestro's JUnit report and every flow's artefacts into the call's folder", () => {
    expect(reportArgs('reports/e2e/line-siege')).toStrictEqual([
      ...['--format', 'JUNIT', '--output', 'reports/e2e/line-siege/junit.xml'],
      ...['--test-output-dir', 'reports/e2e/line-siege'],
    ]);
  });
});

describe('the flow lists of both runners', () => {
  it("lists the Shell's and the game's top-level flows, sorted (Maestro does not recurse)", () => {
    const flows = allFlows('line-siege');
    expect(flows).toStrictEqual([...flows].sort());
    expect(flows).toContain('packages/shell/e2e/flows/smoke/01-first-launch.yaml');
    expect(
      flows.every((flow) =>
        /^(packages\/shell|apps\/line-siege)\/e2e\/flows\/[^/]+\/[^/]+\.yaml$/.test(flow),
      ),
    ).toBe(true);
  });

  it('lists only the a11y flows for the large-text step', () => {
    const flows = largeTextFlows('line-siege');
    expect(flows).toStrictEqual(
      allFlows('line-siege').filter((flow) => flow.includes('/flows/a11y/')),
    );
  });
});

describe('mergeJunitInto', () => {
  let out = '';
  beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), 'flow-files-'));
  });
  afterEach(() => {
    rmSync(out, { recursive: true, force: true });
  });

  const writeReport = (dir: string, text: string): void => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'junit.xml'), text);
  };

  it("adds a later call's test cases to the step's junit.xml", () => {
    writeReport(out, report(['a']));
    writeReport(join(out, 'save-benchmark-flow'), report(['b']));
    expect(mergeJunitInto(out, join(out, 'save-benchmark-flow'))).toBeNull();
    expect(readFileSync(join(out, 'junit.xml'), 'utf8')).toBe(report(['a', 'b']));
  });

  it("does nothing when the call wrote no report (Maestro's exit code fails the step)", () => {
    expect(mergeJunitInto(out, join(out, 'offline-flows'))).toBeNull();
    expect(existsSync(join(out, 'junit.xml'))).toBe(false);
  });

  it('turns a report that cannot be merged into a failure line, never a crash', () => {
    writeReport(out, report(['a']));
    writeReport(join(out, 'offline-flows'), 'not a report');
    expect(mergeJunitInto(out, join(out, 'offline-flows'))).toMatch(
      new RegExp(`^flows: .+ \\(see ${join(out, 'offline-flows')}\\)$`),
    );
  });
});
