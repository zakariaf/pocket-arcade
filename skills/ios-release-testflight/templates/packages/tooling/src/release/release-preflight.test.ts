// packages/tooling/src/release/release-preflight.test.ts
// Owner decision O6: the fa/ckb review is the owner's step R3 and never stops a release.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertOwnerValues,
  plannedBuildNumber,
  reportTranslationsToReview,
} from './release-preflight.ts';
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

// Lead decision L14 and spec 8.8: a store/live release stops at step 1 while game.config.ts holds a
// stand-in for the owner's AdMob ids (G5) or links (G3); a test release keeps Google's test ids.
describe('assertOwnerValues', () => {
  const SAMPLE_IDS = {
    ads: {
      isEnabled: true,
      ids: {
        ios: {
          appId: 'ca-app-pub-3940256099942544~1458002511',
          units: {
            banner: 'ca-app-pub-7310520968431056/4417703951',
            interstitial: 'ca-app-pub-3940256099942544/4411468910',
            rewarded: 'ca-app-pub-7310520968431056/2913050594',
          },
        },
      },
    },
    links: { privacyPolicy: { host: 'games.applander.io' }, supportEmail: 'support@applander.io' },
  } as const;

  it("stops a store/live release on Google's sample ids before anything is built", () => {
    const live = { appVariant: 'store', adsMode: 'live' } as const;
    expect(() => {
      assertOwnerValues(SAMPLE_IDS, live, 'apps/line-siege');
    }).toThrow(
      new Error(
        [
          'apps/line-siege/game.config.ts still holds what the owner replaces, so nothing was built or committed:',
          "- [owner-placeholder] game.config.ts ads.ids.ios.appId is Google's sample (test) AdMob id ca-app-pub-3940256099942544~1458002511 (owner step G5)",
          "- [owner-placeholder] game.config.ts ads.ids.ios.units.interstitial is Google's sample (test) AdMob id ca-app-pub-3940256099942544/4411468910 (owner step G5)",
          'OWNER STEPS PENDING: G5',
        ].join('\n'),
      ),
    );
  });

  it("lets a test release go on with Google's test ids", () => {
    expect(() => {
      assertOwnerValues(SAMPLE_IDS, { appVariant: 'test', adsMode: 'test' }, 'apps/line-siege');
    }).not.toThrow();
  });
});

describe('plannedBuildNumber', () => {
  it('is the next build number, read before the bump commit writes it', () => {
    const appDir = mkdtempSync(join(tmpdir(), 'release-preflight-'));
    const config = join(appDir, 'game.config.ts');
    writeFileSync(config, 'export default {\n  version: "1.0.0",\n  buildNumber: 7,\n};\n');
    const options = {
      game: 'line-siege',
      variant: { appVariant: 'test', adsMode: 'off' },
      notes: [],
      knownIssues: [],
      resume: null,
    } as const;
    expect(plannedBuildNumber(options, { ...CONTEXT, appDir })).toBe(8);
    expect(readFileSync(config, 'utf8')).toContain('  buildNumber: 7,\n');
  });
});
