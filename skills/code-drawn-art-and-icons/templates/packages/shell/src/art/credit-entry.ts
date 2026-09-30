// packages/shell/src/art/credit-entry.ts

/** What an S11d row is about; the screen groups rows by kind. */
export type CreditKind = 'font' | 'sound' | 'word-list' | 'native-library' | 'npm-package';

/** One row of the S11d licences screen. Proper names are not translated; headings are. */
export type CreditEntry = {
  readonly kind: CreditKind;
  readonly name: string;
  readonly version: string;
  /** SPDX identifier, or 'LicenseRef-<name>' for non-SPDX terms (Google SDK terms). */
  readonly license: string;
  readonly copyright: string;
  /** Where the asset comes from, host and path without a scheme (spec N3: no URL literals in app code). */
  readonly source: string;
};
