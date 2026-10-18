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
