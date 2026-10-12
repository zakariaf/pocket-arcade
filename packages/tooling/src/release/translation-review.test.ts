// packages/tooling/src/release/translation-review.test.ts
import { missingSheetLine, translationReviewLines } from './translation-review.ts';

const SHEET = [
  "review-sheet: fa: 3 of 290 texts wait for the owner's review -> reports/i18n/review-fa.csv",
  "review-sheet: ckb: 0 of 290 texts wait for the owner's review -> reports/i18n/review-ckb.csv",
  'OWNER STEP (not blocking): the owner reads 3 fa and ckb texts ...',
].join('\n');

describe('translationReviewLines', () => {
  it('names each language with texts waiting as a non-blocking owner step', () => {
    expect(translationReviewLines(SHEET)).toStrictEqual([
      'Owner step R3 (not blocking): 3 fa texts await your review: reports/i18n/review-fa.csv',
    ]);
  });

  it('prints nothing when every text was reviewed', () => {
    expect(translationReviewLines(SHEET.replace('fa: 3 of', 'fa: 0 of'))).toStrictEqual([]);
  });
});

describe('missingSheetLine', () => {
  it('keeps a sheet that could not run an owner step, never a stop', () => {
    expect(missingSheetLine('review-sheet.ts is missing')).toBe(
      'Owner step R3 (not blocking): no fa/ckb review list was written (review-sheet.ts is missing); run node packages/tooling/src/i18n/review-sheet.ts after the release',
    );
  });
});
