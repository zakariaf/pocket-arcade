// packages/tooling/src/release/what-to-test.ts
// The TestFlight "What to Test" text. English and for testers only, so it is not an in-app string.

export type WhatToTestInput = {
  readonly gameName: string;
  readonly version: string;
  readonly buildNumber: number;
  readonly appVariant: 'test' | 'store';
  /** feat/fix commit subjects since the previous build tag. */
  readonly changes: readonly string[];
  readonly focus: readonly string[];
  readonly knownIssues: readonly string[];
  /** First build of a game, or purchase code changed since the previous build. */
  readonly needsPurchaseTest: boolean;
};

/** TestFlight accepts up to 4000 characters of whatsNew. */
export const WHATS_NEW_MAX = 4000;
/** The most commit subjects listed; the rest become one "and N more" line. */
export const MAX_CHANGE_LINES = 20;
const PURCHASE_PATH = /purchase|premium|storekit/i;
const PURCHASE_NOTE = /purchase|premium|restore/i;

/**
 * The "What changed" lines: nothing to list on a game's first build (everything is new), and at
 * most MAX_CHANGE_LINES subjects after that, so the text always fits TestFlight's limit.
 */
export function summarizeChanges(subjects: readonly string[], isFirstBuild: boolean): string[] {
  if (isFirstBuild) {
    return ['first TestFlight build of this game: everything is new'];
  }
  if (subjects.length <= MAX_CHANGE_LINES) {
    return [...subjects];
  }
  const more = subjects.length - MAX_CHANGE_LINES;
  return [...subjects.slice(0, MAX_CHANGE_LINES), `and ${String(more)} more fixes and features`];
}

export type PurchaseCheckInput = {
  /** No earlier build tag for this game. */
  readonly isFirstBuild: boolean;
  /** `git diff --name-only <previous build tag>..HEAD` */
  readonly changedFiles: readonly string[];
  readonly notes: readonly string[];
};

/** The Premium buy/cancel/restore check goes in on a first build or when purchase code changed. */
export function purchaseCheckNeeded(input: PurchaseCheckInput): boolean {
  return (
    input.isFirstBuild ||
    input.changedFiles.some((file) => PURCHASE_PATH.test(file)) ||
    input.notes.some((note) => PURCHASE_NOTE.test(note))
  );
}

const PURCHASE_CHECK = 'Buy Premium, cancel a purchase, delete the app, reinstall, then Restore.';
const RTL_CHECK =
  'Switch the language to فارسی and کوردیی ناوەندی once: layout mirrored, nothing cut off.';

function bullets(lines: readonly string[], fallback: string): string[] {
  return (lines.length === 0 ? [fallback] : lines).map((line) => `- ${line}`);
}

export function whatToTest(input: WhatToTestInput): string {
  const text = [
    `${input.gameName} ${input.version} (${String(input.buildNumber)}) · ${input.appVariant} build`,
    'What changed',
    ...bullets(input.changes, 'no player-visible changes'),
    'Please check',
    ...bullets(input.focus, 'play two levels and one daily challenge'),
    ...(input.needsPurchaseTest ? [`- ${PURCHASE_CHECK}`] : []),
    `- ${RTL_CHECK}`,
    'Known issues',
    ...bullets(input.knownIssues, 'none'),
  ].join('\n');
  if (text.length > WHATS_NEW_MAX) {
    throw new Error(
      `What to Test is ${String(text.length)} characters; TestFlight allows ${String(WHATS_NEW_MAX)}`,
    );
  }
  return text;
}
