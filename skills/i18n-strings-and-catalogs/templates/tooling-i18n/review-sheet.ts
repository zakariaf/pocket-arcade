// packages/tooling/src/i18n/review-sheet.ts
// The owner's review sheet for the Persian and Sorani texts (owner decision O6, 2026-09-30: the
// owner reads them personally, every report lists them under "Owner steps (not blocking)", and
// nothing waits for the review). Always exits 0 with the count; exit 2 only for bad input.
//   node packages/tooling/src/i18n/review-sheet.ts [--release]
//     writes reports/i18n/review-<fa|ckb>.csv: every text that differs from its reviewed hash in
//     packages/shell/src/i18n/review-state.json (key, English, current text, where it shows)
//   node packages/tooling/src/i18n/review-sheet.ts --mark-reviewed fa --date 2026-10-02 [--key k]...
//     records the current fa texts (or only the named keys) as reviewed, after the owner's answers
//     are applied to the copy deck and the catalogs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

export const REVIEW_LANGUAGES = ['fa', 'ckb'] as const;
export type ReviewLanguage = (typeof REVIEW_LANGUAGES)[number];
export type Catalog = Readonly<Record<string, string>>;
export type ReviewedText = { readonly sha256: string; readonly reviewedOn: string };
export type ReviewState = Readonly<Record<ReviewLanguage, Readonly<Record<string, ReviewedText>>>>;
export type ReviewRow = {
  readonly key: string;
  readonly english: string;
  readonly current: string;
  readonly shownOn: string;
};
export type Catalogs = { readonly en: Catalog; readonly fa: Catalog; readonly ckb: Catalog };
export type ReviewInput = {
  readonly catalogs: Catalogs;
  readonly language: ReviewLanguage;
  readonly state: ReviewState;
  /** The app folders with catalogs: their keys start with the game id. */
  readonly gameIds: readonly string[];
};

export const REVIEW_STATE_FILE = 'packages/shell/src/i18n/review-state.json';
const SHELL_CATALOGS = 'packages/shell/src/i18n/catalogs';
const REPORT_DIR = 'reports/i18n';
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY_STATE: ReviewState = { fa: {}, ckb: {} };
const USAGE =
  'Usage: node packages/tooling/src/i18n/review-sheet.ts [--release] | --mark-reviewed <fa|ckb> --date YYYY-MM-DD [--key <key>]...';

/** Where a Shell key's first segment shows, for the reviewer (the screen map of the spec). */
const SHOWN_ON: Readonly<Record<string, string>> = {
  splash: 'S1 Splash',
  'language-choice': 'S2 First-run language choice',
  consent: 'S3 Ad consent',
  home: 'S4 Home',
  'game-screen': 'S5 Game screen',
  pause: 'S6 Pause menu',
  result: 'S7 Result screen',
  levels: 'S8 Levels',
  daily: 'S9 Daily challenge',
  stats: 'S10 Statistics',
  settings: 'S11 Settings',
  language: 'S11a Language',
  about: 'S11b About and credits',
  privacy: 'S11c Privacy policy',
  licences: 'S11d Licences',
  premium: 'S12 Premium',
  'how-to-play': 'S13 How to play',
  tutorial: 'S13 Tutorial',
  dialog: 'S14 Dialogs',
  common: 'several screens',
  date: 'dates on S4, S5, S9, S10 and S11c',
};

export function sha256Of(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** The screen a reviewer opens to see the text in place. */
export function shownOnOf(key: string, gameIds: readonly string[]): string {
  if (key.endsWith('.usage-description')) return 'iOS system dialog (Info.plist)';
  const area = key.split('.')[0] ?? '';
  if (gameIds.includes(area)) return `${area} game texts (S5, S7, S13)`;
  return SHOWN_ON[area] ?? 'Shell text';
}

/**
 * A text the owner reads. The S15 debug menu (debug.*) stays English in every language (lead
 * decision L13), so it is never on a sheet, in a count or in the review state.
 */
export function isReviewable(key: string): boolean {
  return !key.startsWith('debug.');
}

/** Every text of one language that differs from its reviewed hash. debug.* stays English (S15). */
export function pendingRows({ catalogs, language, state, gameIds }: ReviewInput): ReviewRow[] {
  const catalog = catalogs[language];
  return Object.keys(catalog)
    .filter(isReviewable)
    .filter((key) => state[language][key]?.sha256 !== sha256Of(catalog[key] ?? ''))
    .sort()
    .map((key) => ({
      key,
      english: catalogs.en[key] ?? '',
      current: catalog[key] ?? '',
      shownOn: shownOnOf(key, gameIds),
    }));
}

const quoted = (field: string): string => `"${field.replaceAll('"', '""')}"`;

/** UTF-8 CSV with a byte-order mark, so spreadsheet apps show Persian and Sorani letters. */
export function csvOf(rows: readonly ReviewRow[]): string {
  const lines = [
    ['key', 'english', 'current', 'shown on'],
    ...rows.map((row) => [row.key, row.english, row.current, row.shownOn]),
  ];
  return `\uFEFF${lines.map((fields) => fields.map(quoted).join(',')).join('\n')}\n`;
}

/** The state after the owner reviewed the current texts of `keys` (all but debug.* when empty). */
export function markReviewed(
  state: ReviewState,
  catalog: Catalog,
  mark: {
    readonly language: ReviewLanguage;
    readonly date: string;
    readonly keys: readonly string[];
  },
): ReviewState {
  const keys = mark.keys.length > 0 ? mark.keys : Object.keys(catalog).filter(isReviewable);
  const entries = keys.map((key): [string, ReviewedText] => {
    if (!isReviewable(key))
      throw new Error(`review-sheet: ${key} is a debug menu text: it stays English (L13)`);
    const text = catalog[key];
    if (text === undefined)
      throw new Error(`review-sheet: ${key} is not in the ${mark.language} catalogs`);
    return [key, { sha256: sha256Of(text), reviewedOn: mark.date }];
  });
  const merged = Object.entries({ ...state[mark.language], ...Object.fromEntries(entries) });
  const sorted = merged.sort(([a], [b]) => (a < b ? -1 : 1));
  return { ...state, [mark.language]: Object.fromEntries(sorted) };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function readCatalogs(root: string): { readonly catalogs: Catalogs; readonly gameIds: string[] } {
  if (!existsSync(join(root, SHELL_CATALOGS, 'en.json')))
    throw new Error(`review-sheet: no Shell catalogs in ${SHELL_CATALOGS}`);
  const apps = join(root, 'apps');
  const gameIds = existsSync(apps)
    ? readdirSync(apps)
        .filter((id) => existsSync(join(apps, id, 'src', 'i18n', 'en.json')))
        .sort()
    : [];
  const dirs = [join(root, SHELL_CATALOGS), ...gameIds.map((id) => join(apps, id, 'src', 'i18n'))];
  const merged = (language: string): Catalog =>
    Object.assign(
      {},
      ...dirs.map((dir) => readJson(join(dir, `${language}.json`)) as Catalog),
    ) as Catalog;
  return { catalogs: { en: merged('en'), fa: merged('fa'), ckb: merged('ckb') }, gameIds };
}

function readState(root: string): ReviewState {
  const path = join(root, REVIEW_STATE_FILE);
  if (!existsSync(path)) return EMPTY_STATE;
  const state = readJson(path) as Partial<ReviewState>;
  return { fa: state.fa ?? {}, ckb: state.ckb ?? {} };
}

function writeSheets(root: string): number {
  const { catalogs, gameIds } = readCatalogs(root);
  const state = readState(root);
  mkdirSync(join(root, REPORT_DIR), { recursive: true });
  let pending = 0;
  for (const language of REVIEW_LANGUAGES) {
    const rows = pendingRows({ catalogs, language, state, gameIds });
    const file = `${REPORT_DIR}/review-${language}.csv`;
    writeFileSync(join(root, file), csvOf(rows));
    pending += rows.length;
    const reviewable = Object.keys(catalogs[language]).filter(isReviewable).length;
    console.log(
      `review-sheet: ${language}: ${String(rows.length)} of ${String(reviewable)} texts wait for the owner's review -> ${file}`,
    );
  }
  console.log(
    pending > 0
      ? `OWNER STEP (not blocking): the owner reads ${String(pending)} fa and ckb texts in ${REPORT_DIR}/review-fa.csv and ${REPORT_DIR}/review-ckb.csv; list them under "Owner steps (not blocking)" in the report. Nothing waits for it.`
      : 'review-sheet: every fa and ckb text has been reviewed',
  );
  return 0;
}

function writeMark(
  root: string,
  values: {
    readonly language: string;
    readonly date: string | undefined;
    readonly keys: readonly string[];
  },
): number {
  const language = REVIEW_LANGUAGES.find((known) => known === values.language);
  if (language === undefined || values.date === undefined || !DATE_KEY.test(values.date))
    throw new Error(
      `review-sheet: --mark-reviewed needs fa or ckb and --date YYYY-MM-DD\n${USAGE}`,
    );
  const { catalogs } = readCatalogs(root);
  const next = markReviewed(readState(root), catalogs[language], {
    language,
    date: values.date,
    keys: values.keys,
  });
  writeFileSync(join(root, REVIEW_STATE_FILE), `${JSON.stringify(next, null, 2)}\n`);
  console.log(
    `review-sheet: ${language}: ${String(Object.keys(next[language]).length)} texts recorded as reviewed on ${values.date} in ${REVIEW_STATE_FILE}`,
  );
  return 0;
}

/** The command line. Returns the exit code: 0 whatever waits for review, 2 for bad input. */
export function runReviewSheet(root: string, argv: readonly string[]): number {
  try {
    const { values } = parseArgs({
      args: [...argv],
      options: {
        release: { type: 'boolean', default: false },
        'mark-reviewed': { type: 'string' },
        date: { type: 'string' },
        key: { type: 'string', multiple: true, default: [] },
      },
    });
    const mark = values['mark-reviewed'];
    return mark === undefined
      ? writeSheets(root)
      : writeMark(root, { language: mark, date: values.date, keys: values.key });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    return 2;
  }
}

if ((process.argv[1] ?? '').endsWith('review-sheet.ts')) {
  process.exitCode = runReviewSheet(process.cwd(), process.argv.slice(2));
}
