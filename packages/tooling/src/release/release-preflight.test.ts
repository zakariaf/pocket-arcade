// packages/tooling/src/release/release-preflight.test.ts
// Owner decision O6: the fa/ckb review is the owner's step R3 and never stops a release.
import { existsSync } from 'node:fs';

import { reportTranslationsToReview } from './release-preflight.ts';
import { runReleaseStep } from './release-runner.ts';

jest.mock('node:fs', () => ({ ...jest.requireActual<object>('node:fs'), existsSync: jest.fn() }));
jest.mock('./release-runner.ts', () => ({ runReleaseStep: jest.fn() }));

const CONTEXT = { game: 'line-siege', appDir: 'apps/line-siege', env: {} };
const SHEET =
  "review-sheet: fa: 3 of 290 texts wait for the owner's review -> reports/i18n/review-fa.csv\n" +
  "review-sheet: ckb: 2 of 290 texts wait for the owner's review -> reports/i18n/review-ckb.csv\n";

describe('reportTranslationsToReview', () => {
  let printed: string[] = [];
  beforeEach(() => {
    printed = [];
    jest.spyOn(console, 'log').mockImplementation((line: string) => {
      printed.push(line);
    });
    jest.mocked(existsSync).mockReturnValue(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs the review sheet without --release and names the owner step, then goes on', () => {
    jest.mocked(runReleaseStep).mockReturnValue(SHEET);
    expect(() => {
      reportTranslationsToReview(CONTEXT);
    }).not.toThrow();
    expect(jest.mocked(runReleaseStep)).toHaveBeenCalledWith(
      'i18n-review',
      { file: 'node', args: ['packages/tooling/src/i18n/review-sheet.ts'], atRoot: true },
      CONTEXT,
    );
    expect(printed).toStrictEqual([
      'release:ios: Owner step R3 (not blocking): 3 fa texts await your review: reports/i18n/review-fa.csv',
      'release:ios: Owner step R3 (not blocking): 2 ckb texts await your review: reports/i18n/review-ckb.csv',
    ]);
  });

  it('keeps a failed or missing sheet an owner step: the release never stops for it', () => {
    jest.mocked(runReleaseStep).mockImplementation(() => {
      throw new Error('step "i18n-review" failed');
    });
    expect(() => {
      reportTranslationsToReview(CONTEXT);
    }).not.toThrow();
    jest.mocked(existsSync).mockReturnValue(false);
    reportTranslationsToReview(CONTEXT);
    expect(printed.every((line) => line.includes('Owner step R3 (not blocking)'))).toBe(true);
    expect(printed).toHaveLength(2);
  });
});
