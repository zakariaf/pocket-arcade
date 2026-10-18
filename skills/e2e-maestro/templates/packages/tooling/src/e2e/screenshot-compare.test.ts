// packages/tooling/src/e2e/screenshot-compare.test.ts
// The folders and the compare of both capture scripts; the capture itself is a temporary file.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  checkShot,
  combosOf,
  jobOf,
  MAX_DIFF_RATIO,
  type ShotLayout,
} from './screenshot-compare.ts';

const IOS: ShotLayout = {
  game: 'line-siege',
  baselines: 'baselines',
  reports: join('reports', 'screenshots'),
  suffix: '',
  isUpdate: false,
  compare: () => ({ kind: 'match', diffRatio: 0 }),
};
const ANDROID: ShotLayout = {
  game: 'line-siege',
  baselines: 'baselines-android',
  reports: join('reports', 'screenshots-android'),
  suffix: '-font-scale-2.0',
  isUpdate: false,
  compare: () => ({ kind: 'match', diffRatio: 0 }),
};
const FA_DARK = { device: 'tablet', lang: 'fa', theme: 'dark' } as const;

describe('MAX_DIFF_RATIO', () => {
  it('stays at 0.2 % of the pixels on both platforms (spec: never raised)', () => {
    expect(MAX_DIFF_RATIO).toBe(0.002);
  });
});

describe('combosOf', () => {
  it('captures every language in light, then every language in dark', () => {
    expect(combosOf(['en', 'fa'], 'phone')).toStrictEqual([
      { device: 'phone', lang: 'en', theme: 'light' },
      { device: 'phone', lang: 'fa', theme: 'light' },
      { device: 'phone', lang: 'en', theme: 'dark' },
      { device: 'phone', lang: 'fa', theme: 'dark' },
    ]);
  });
});

describe('jobOf', () => {
  const run = (): Promise<never[]> => Promise.resolve([]);

  it("keeps iOS's folders: baselines/, reports/screenshots/raw/", () => {
    const job = jobOf(IOS, FA_DARK, run);
    expect([job.label, job.outDir, job.baselineDir]).toStrictEqual([
      'tablet/fa-dark',
      'reports/screenshots/raw/tablet/fa-dark',
      'apps/line-siege/e2e/baselines/tablet/fa-dark',
    ]);
    expect(job.run).toBe(run);
  });

  it("keeps Android's apart: baselines-android/, reports/screenshots-android/, the font scale", () => {
    const job = jobOf(ANDROID, FA_DARK, run);
    expect([job.label, job.outDir, job.baselineDir]).toStrictEqual([
      'tablet/fa-dark-font-scale-2.0',
      'reports/screenshots-android/raw/tablet/fa-dark-font-scale-2.0',
      'apps/line-siege/e2e/baselines-android/tablet/fa-dark-font-scale-2.0',
    ]);
  });
});

describe('checkShot', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'screenshot-compare-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('compares a capture with the baseline of its name at MAX_DIFF_RATIO, its diff under diff/', () => {
    const actual = join(dir, 'home.png');
    writeFileSync(actual, 'png bytes');
    const calls: unknown[] = [];
    const compare = (bytes: Buffer, options: object) => {
      calls.push([bytes.toString(), options]);
      return { kind: 'match' as const, diffRatio: 0 };
    };
    const baseline = 'apps/line-siege/e2e/baselines-android/tablet/fa-dark-font-scale-2.0/home.png';
    expect(checkShot({ ...ANDROID, compare }, FA_DARK, actual)).toStrictEqual({
      label: 'tablet/fa-dark-font-scale-2.0/home',
      actual,
      baseline,
      result: { kind: 'match', diffRatio: 0 },
    });
    expect(calls).toStrictEqual([
      [
        'png bytes',
        {
          baselinePath: baseline,
          diffPath: 'reports/screenshots-android/diff/tablet/fa-dark-font-scale-2.0/home.png',
          maxDiffRatio: 0.002,
        },
      ],
    ]);
  });
});
