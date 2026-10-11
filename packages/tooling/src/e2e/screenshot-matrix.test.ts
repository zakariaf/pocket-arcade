// packages/tooling/src/e2e/screenshot-matrix.test.ts
// The screenshots:ios matrix runs to its end: a combination that fails is recorded and the next
// one still runs, so summary.json and the gallery are always written, and the run exits 1 with
// the list of what failed.
import { captureEach, captureFailureRow, matrixOutcome } from './screenshot-matrix.ts';

import type { GalleryRow } from './write-gallery.ts';

const shot = (label: string, kind: 'match' | 'mismatch'): GalleryRow => ({
  label,
  actual: `reports/screenshots/raw/${label}.png`,
  baseline: `apps/demo/e2e/baselines/${label}.png`,
  result:
    kind === 'match'
      ? { kind: 'match', diffRatio: 0 }
      : { kind: 'mismatch', diffRatio: 0.01, diffPath: `reports/screenshots/diff/${label}.png` },
});

const job = (label: string, run: () => Promise<GalleryRow[]>) => ({
  label,
  outDir: `reports/screenshots/raw/${label}`,
  baselineDir: `apps/demo/e2e/baselines/${label}`,
  run,
});

describe('captureEach', () => {
  it('records a failed combination and still runs the ones after it, in order', async () => {
    const ran: string[] = [];
    const rows = await captureEach([
      job('phone/en-light', () => {
        ran.push('phone/en-light');
        return Promise.resolve([shot('phone/en-light/home', 'match')]);
      }),
      job('phone/fa-light', () => {
        ran.push('phone/fa-light');
        return Promise.reject(new Error('screenshots: maestro exited 1'));
      }),
      job('phone/en-dark', () => {
        ran.push('phone/en-dark');
        return Promise.resolve([shot('phone/en-dark/home', 'match')]);
      }),
    ]);
    expect(ran).toStrictEqual(['phone/en-light', 'phone/fa-light', 'phone/en-dark']);
    expect(
      rows.map((row) => [row.label, row.result === 'baseline-written' ? '' : row.result.kind]),
    ).toStrictEqual([
      ['phone/en-light/home', 'match'],
      ['phone/fa-light', 'capture-failed'],
      ['phone/en-dark/home', 'match'],
    ]);
  });
});

describe('captureFailureRow', () => {
  it('names the combination, the error and the Maestro output folder', () => {
    expect(
      captureFailureRow(
        job('tablet/ckb-dark', () => Promise.resolve([])),
        new Error('boot failed'),
      ),
    ).toStrictEqual({
      label: 'tablet/ckb-dark',
      actual: 'reports/screenshots/raw/tablet/ckb-dark',
      baseline: 'apps/demo/e2e/baselines/tablet/ckb-dark',
      result: {
        kind: 'capture-failed',
        message: 'boot failed',
        outDir: 'reports/screenshots/raw/tablet/ckb-dark',
      },
    });
  });
});

describe('matrixOutcome', () => {
  it('passes a matrix with no change and no failed combination', () => {
    expect(matrixOutcome([shot('phone/en-light/home', 'match')])).toStrictEqual({
      exitCode: 0,
      lines: ['1 screenshots, 0 changed, 0 combinations failed'],
    });
  });

  it('exits 1 and lists every failed combination after the counts', () => {
    const failed = captureFailureRow(
      job('phone/fa-light', () => Promise.resolve([])),
      new Error('screenshots: maestro exited 1'),
    );
    expect(
      matrixOutcome([
        shot('phone/en-light/home', 'mismatch'),
        failed,
        shot('phone/en-dark/home', 'match'),
      ]),
    ).toStrictEqual({
      exitCode: 1,
      lines: [
        '2 screenshots, 1 changed, 1 combinations failed',
        'capture failed: phone/fa-light: screenshots: maestro exited 1 (see reports/screenshots/raw/phone/fa-light)',
      ],
    });
  });
});
