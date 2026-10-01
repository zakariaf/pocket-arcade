// packages/tooling/src/i18n/review-sheet.test.ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  REVIEW_STATE_FILE,
  csvOf,
  markReviewed,
  pendingRows,
  runReviewSheet,
  sha256Of,
  shownOnOf,
} from './review-sheet.ts';

import type { ReviewState } from './review-sheet.ts';

const EN = {
  'consent.tracking.usage-description': 'Google uses this to show you ads.',
  'debug.title': 'Debug menu',
  'home.title': 'Home',
};
const FA = {
  'consent.tracking.usage-description': 'گوگل از این برای نمایش تبلیغ استفاده می‌کند.',
  'debug.title': 'Debug menu',
  'home.title': 'خانه',
};
const CKB = {
  'consent.tracking.usage-description': 'گووگڵ ئەمە بەکاردەهێنێت.',
  'debug.title': 'Debug menu',
  'home.title': 'ماڵەوە',
};
const GAME = { 'line-siege.name': 'Line Siege' };
const CATALOGS = { en: EN, fa: FA, ckb: CKB };
const EMPTY: ReviewState = { fa: {}, ckb: {} };

describe('shownOnOf', () => {
  it('names the screen, the game or the system dialog that shows a key', () => {
    expect([
      shownOnOf('home.title', ['line-siege']),
      shownOnOf('line-siege.name', ['line-siege']),
      shownOnOf('consent.tracking.usage-description', []),
      shownOnOf('unknown-area.title', []),
    ]).toStrictEqual([
      'S4 Home',
      'line-siege game texts (S5, S7, S13)',
      'iOS system dialog (Info.plist)',
      'Shell text',
    ]);
  });
});

describe('pendingRows', () => {
  it('lists every text not yet reviewed, sorted, and never the English debug menu', () => {
    const input = { catalogs: CATALOGS, language: 'fa', state: EMPTY, gameIds: [] } as const;
    expect(pendingRows(input).map((row) => row.key)).toStrictEqual([
      'consent.tracking.usage-description',
      'home.title',
    ]);
  });

  describe('when a text was reviewed', () => {
    it('leaves it out until its text changes', () => {
      const state: ReviewState = {
        fa: { 'home.title': { sha256: sha256Of('خانه'), reviewedOn: '2026-10-01' } },
        ckb: {},
      };
      const changed = { ...CATALOGS, fa: { ...FA, 'home.title': 'صفحهٔ اصلی' } };
      const input = { catalogs: CATALOGS, language: 'fa', state, gameIds: [] } as const;
      expect(pendingRows(input).map((row) => row.key)).toStrictEqual([
        'consent.tracking.usage-description',
      ]);
      expect(pendingRows({ ...input, catalogs: changed })).toContainEqual({
        key: 'home.title',
        english: 'Home',
        current: 'صفحهٔ اصلی',
        shownOn: 'S4 Home',
      });
    });
  });
});

describe('csvOf', () => {
  it('writes a byte-order mark, a header and quoted fields', () => {
    const rows = [{ key: 'a.b', english: 'Say "hi"', current: 'سلام، دنیا', shownOn: 'S4 Home' }];
    expect(csvOf(rows)).toBe(
      '\uFEFF"key","english","current","shown on"\n"a.b","Say ""hi""","سلام، دنیا","S4 Home"\n',
    );
  });
});

describe('markReviewed', () => {
  it('records the hash and the date of every text but debug.*, keys sorted', () => {
    const next = markReviewed(EMPTY, CKB, { language: 'ckb', date: '2026-10-02', keys: [] });
    expect(next.ckb).toStrictEqual({
      'consent.tracking.usage-description': {
        sha256: sha256Of(CKB['consent.tracking.usage-description']),
        reviewedOn: '2026-10-02',
      },
      'home.title': { sha256: sha256Of('ماڵەوە'), reviewedOn: '2026-10-02' },
    });
    expect(next.fa).toStrictEqual({});
  });

  it('records only the named keys, and refuses a key the catalogs lack', () => {
    const one = markReviewed(EMPTY, FA, {
      language: 'fa',
      date: '2026-10-02',
      keys: ['home.title'],
    });
    expect(Object.keys(one.fa)).toStrictEqual(['home.title']);
    expect(() =>
      markReviewed(EMPTY, FA, { language: 'fa', date: '2026-10-02', keys: ['home.nothing'] }),
    ).toThrow('home.nothing is not in the fa catalogs');
  });
});

describe('runReviewSheet', () => {
  // Each test gets its own repo folder: coverage runs tests in random order.
  let root = '';
  let output: string[] = [];

  const put = (rel: string, value: object): void => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), `${JSON.stringify(value, null, 2)}\n`);
  };
  const read = (rel: string): string => readFileSync(path.join(root, rel), 'utf8');

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'review-sheet-'));
    output = [];
    const record = (...parts: unknown[]): void => {
      output.push(parts.map(String).join(' '));
    };
    jest.spyOn(console, 'log').mockImplementation(record);
    jest.spyOn(console, 'error').mockImplementation(record);
    for (const [language, catalog] of Object.entries(CATALOGS)) {
      put(`packages/shell/src/i18n/catalogs/${language}.json`, catalog);
      put(`apps/line-siege/src/i18n/${language}.json`, GAME);
    }
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes both sheets, prints the owner step and exits 0 on a release run', () => {
    expect(runReviewSheet(root, ['--release'])).toBe(0);
    expect(read('reports/i18n/review-fa.csv')).toContain('"line-siege.name","Line Siege"');
    expect(read('reports/i18n/review-ckb.csv').split('\n')).toHaveLength(5);
    expect(output).toContain(
      "review-sheet: fa: 3 of 4 texts wait for the owner's review -> reports/i18n/review-fa.csv",
    );
    expect(output.at(-1)).toMatch(/^OWNER STEP \(not blocking\): the owner reads 6 fa and ckb/);
  });

  it('finds nothing to review once both languages are marked', () => {
    expect(runReviewSheet(root, ['--mark-reviewed', 'fa', '--date', '2026-10-02'])).toBe(0);
    expect(runReviewSheet(root, ['--mark-reviewed', 'ckb', '--date', '2026-10-02'])).toBe(0);
    expect(Object.keys(JSON.parse(read(REVIEW_STATE_FILE)) as ReviewState)).toStrictEqual([
      'fa',
      'ckb',
    ]);
    expect(runReviewSheet(root, [])).toBe(0);
    expect(output.at(-1)).toBe('review-sheet: every fa and ckb text has been reviewed');
  });

  it('exits 2 for bad input and never for texts that wait', () => {
    expect(runReviewSheet(root, ['--mark-reviewed', 'de', '--date', '2026-10-02'])).toBe(2);
    expect(runReviewSheet(root, ['--mark-reviewed', 'fa'])).toBe(2);
    expect(runReviewSheet(root, ['--strict'])).toBe(2);
    rmSync(path.join(root, 'packages'), { recursive: true });
    expect(runReviewSheet(root, [])).toBe(2);
    expect(output).toContain('review-sheet: no Shell catalogs in packages/shell/src/i18n/catalogs');
  });
});
