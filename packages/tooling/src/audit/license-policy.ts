// packages/tooling/src/audit/license-policy.ts

/** Licences a shipped dependency may use without an exception. */
export const ALLOWED_LICENSES = [
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'OFL-1.1',
  'CC0-1.0',
] as const;

export type LicenseException = { readonly license: string; readonly reason: string };

/**
 * True when an SPDX expression is acceptable: an OR needs one allowed side, an AND needs both.
 * Parentheses are not nested in any npm package we ship, so one level is enough.
 */
export function isAllowedLicense(expression: string): boolean {
  const cleaned = expression.replace(/[()]/gu, '').trim();
  if (cleaned.includes(' OR ')) {
    return cleaned.split(' OR ').some((part) => isAllowedLicense(part));
  }
  if (cleaned.includes(' AND ')) {
    return cleaned.split(' AND ').every((part) => isAllowedLicense(part));
  }
  return ALLOWED_LICENSES.some((allowed) => allowed === cleaned);
}

/** Maps a bundled source path to the package root that owns it, or null for our own code. */
export function packageRootOf(sourcePath: string): string | null {
  const match = /^(?<root>.*node_modules\/(?:@[^/]+\/)?[^/]+)\//u.exec(sourcePath);
  return match?.groups?.['root'] ?? null;
}

/** Returns one problem per package whose licence is neither allowed nor excepted. */
export function licenseProblems(
  licenses: ReadonlyMap<string, string | null>,
  exceptions: Readonly<Record<string, LicenseException>>,
): readonly string[] {
  return [...licenses.entries()].flatMap(([name, license]) => {
    if (license !== null && isAllowedLicense(license)) {
      return [];
    }
    if (exceptions[name]?.license === license) {
      return [];
    }
    return [`${name}: licence "${String(license)}" is not allowed and has no exception entry`];
  });
}
