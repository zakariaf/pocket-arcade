// packages/tooling/src/e2e/flow-files.ts
// The flow lists and the JUnit reports e2e:ios and e2e:android share. Maestro runs only the
// top-level files of a folder it is given, so the flows are listed one by one: every
// <area>/<nn>-<name>.yaml of the Shell and the game, and the a11y area alone for the large-text
// step. A call made apart from the flows step (the save benchmark, the offline journeys) writes its
// own junit.xml, whose test cases then join the step's report.
import { existsSync, globSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { mergeJunitReports } from '@e07/tooling/e2e/junit-merge.ts';

/** `maestro test` options: the JUnit report and each flow's artefacts into `dir`. */
export function reportArgs(dir: string): string[] {
  return ['--format', 'JUNIT', '--output', join(dir, 'junit.xml'), '--test-output-dir', dir];
}

function flowsOf(game: string, area: string): string[] {
  return [
    ...globSync(`packages/shell/e2e/flows/${area}/*.yaml`),
    ...globSync(`apps/${game}/e2e/flows/${area}/*.yaml`),
  ].sort();
}

/** Every top-level flow of the Shell and the game, sorted. */
export function allFlows(game: string): string[] {
  return flowsOf(game, '*');
}

/** The a11y flows of the large-text step (the Shell's and the game's), sorted. */
export function largeTextFlows(game: string): string[] {
  return flowsOf(game, 'a11y');
}

/**
 * Adds the test cases of a call's report in `dir` to `out`/junit.xml (one report for the step).
 * Null when merged or when the call wrote no report (its exit code already fails the step); a
 * report that cannot be merged is a failure line, never a crash of the run.
 */
export function mergeJunitInto(out: string, dir: string): string | null {
  const extra = join(dir, 'junit.xml');
  if (!existsSync(extra)) return null;
  const junit = join(out, 'junit.xml');
  const main = existsSync(junit) ? readFileSync(junit, 'utf8') : '';
  try {
    writeFileSync(junit, mergeJunitReports(main, readFileSync(extra, 'utf8')));
    return null;
  } catch (error: unknown) {
    return `flows: ${error instanceof Error ? error.message : String(error)} (see ${dir})`;
  }
}
