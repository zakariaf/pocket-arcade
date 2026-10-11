// packages/tooling/src/e2e/screenshot-matrix.ts
// The screenshots:ios matrix runs to its end: each device/language/theme combination is one job,
// and a job that fails (a simulator that does not boot, a Maestro run that exits non-zero) becomes
// a capture-failed row while the next job still runs. capture-screenshots-ios.ts then always
// writes summary.json and the gallery, and exits 1 with the list of what failed (check-e2e-report
// rule screenshot-capture-failed reads the same rows).
import { CAPTURE_FAILED, isChanged } from './write-gallery.ts';

import type { CaptureFailure, GalleryRow } from './write-gallery.ts';

/** One combination: its label (`<device>/<lang>-<theme>`), its folders, and its capture. */
export type MatrixJob = {
  readonly label: string;
  /** reports/screenshots/raw/<combination>: Maestro's log and screenshots. */
  readonly outDir: string;
  /** apps/<game>/e2e/baselines/<combination> */
  readonly baselineDir: string;
  readonly run: () => Promise<GalleryRow[]>;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const failureOf = (row: GalleryRow): CaptureFailure | null =>
  row.result !== 'baseline-written' && row.result.kind === CAPTURE_FAILED ? row.result : null;

/** The row of a combination that failed: the gallery and summary.json show it with its error. */
export function captureFailureRow(job: MatrixJob, error: unknown): GalleryRow {
  return {
    label: job.label,
    actual: job.outDir,
    baseline: job.baselineDir,
    result: { kind: CAPTURE_FAILED, message: messageOf(error), outDir: job.outDir },
  };
}

/** Runs every job in order; a job that throws or rejects becomes its capture-failed row. */
export async function captureEach(jobs: readonly MatrixJob[]): Promise<GalleryRow[]> {
  const rows: GalleryRow[] = [];
  for (const job of jobs) {
    try {
      rows.push(...(await job.run()));
    } catch (error: unknown) {
      rows.push(captureFailureRow(job, error));
    }
  }
  return rows;
}

/** The run's end: the counts, one line per failed combination, and the exit code. */
export function matrixOutcome(rows: readonly GalleryRow[]): {
  readonly exitCode: 0 | 1;
  readonly lines: string[];
} {
  const failed = rows.filter((row) => failureOf(row) !== null);
  const shots = rows.filter((row) => failureOf(row) === null);
  const changed = shots.filter(({ result }) => isChanged(result));
  const counts = `${String(shots.length)} screenshots, ${String(changed.length)} changed, ${String(failed.length)} combinations failed`;
  const failures = failed.map((row) => {
    const failure = failureOf(row);
    return `capture failed: ${row.label}: ${failure?.message ?? ''} (see ${failure?.outDir ?? ''})`;
  });
  return {
    exitCode: failed.length === 0 && changed.length === 0 ? 0 : 1,
    lines: [counts, ...failures],
  };
}
