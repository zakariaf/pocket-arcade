// packages/tooling/src/release/translation-review.ts
// Owner decision O6 (2026-09-30): the owner reviews the Persian and Sorani texts personally, and
// nothing waits for it. A store release runs the review sheet (i18n-strings-and-catalogs'
// review-sheet.ts, which writes reports/i18n/review-<fa|ckb>.csv and always exits 0), prints one
// "Owner step R3 (not blocking)" line per language with texts waiting, and continues.

export const REVIEW_SHEET = 'packages/tooling/src/i18n/review-sheet.ts';

/** The owner-step lines from the sheet's output ("review-sheet: fa: 3 of 290 texts wait ..."). */
export function translationReviewLines(sheetOutput: string): string[] {
  const lines: string[] = [];
  for (const match of sheetOutput.matchAll(/review-sheet: (fa|ckb): (\d+) of \d+ texts/g)) {
    const [, language = '', count = '0'] = match;
    if (Number(count) === 0) continue;
    lines.push(
      `Owner step R3 (not blocking): ${count} ${language} texts await your review: reports/i18n/review-${language}.csv`,
    );
  }
  return lines;
}

/** When the sheet cannot run: still an owner step, never a stop. */
export function missingSheetLine(reason: string): string {
  return `Owner step R3 (not blocking): no fa/ckb review list was written (${reason}); run node ${REVIEW_SHEET} after the release`;
}
