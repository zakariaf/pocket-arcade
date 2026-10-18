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
 * AND binds tighter than OR and parentheses group, as SPDX defines; a malformed expression is
 * never allowed.
 */
export function isAllowedLicense(expression: string): boolean {
  const tokens = expression.replace(/[()]/gu, ' $& ').trim().split(/\s+/u);
  let next = 0;
  const peek = (): string | undefined => tokens[next];
  const take = (): string | undefined => tokens[next++];

  function parseOr(): boolean | null {
    let isAllowed = parseAnd();
    while (isAllowed !== null && peek() === 'OR') {
      take();
      const isRightAllowed = parseAnd();
      isAllowed = isRightAllowed === null ? null : isAllowed || isRightAllowed;
    }
    return isAllowed;
  }

  function parseAnd(): boolean | null {
    let isAllowed = parseTerm();
    while (isAllowed !== null && peek() === 'AND') {
      take();
      const isRightAllowed = parseTerm();
      isAllowed = isRightAllowed === null ? null : isAllowed && isRightAllowed;
    }
    return isAllowed;
  }

  function parseTerm(): boolean | null {
    const token = take();
    if (token === '(') {
      const isInnerAllowed = parseOr();
      return take() === ')' ? isInnerAllowed : null;
    }
    if (token === undefined || token === ')' || token === 'AND' || token === 'OR') {
      return null;
    }
    return ALLOWED_LICENSES.some((allowed) => allowed === token);
  }

  const isWhole = parseOr();
  return isWhole === true && next === tokens.length;
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

/**
 * The source maps `npm run audit:network` exports for every app under `dist-audit/<game-id>/`: the
 * iOS bundle always, and the Android bundle once the game is ported to Android. Both ship, so both
 * are audited.
 */
export const LICENSE_MAP_GLOBS: readonly string[] = [
  'dist-audit/*/_expo/static/js/ios/*.map',
  'dist-audit/*/_expo/static/js/android/*.map',
];

/** The maps to audit: the files named on the command line, else every iOS and Android export map. */
export function licenseMapFiles(
  argv: readonly string[],
  glob: (pattern: string) => readonly string[],
): readonly string[] {
  return argv.length > 0 ? argv : LICENSE_MAP_GLOBS.flatMap((pattern) => glob(pattern));
}
