// packages/tooling/src/audit/audit-licenses.ts
// `npm run audit:licenses`: every npm package that ends up in a release JS bundle must carry an
// allowed licence. Input: the source maps written by `npm run audit:network` (expo export).
import { existsSync, globSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { licenseProblems, packageRootOf, type LicenseException } from './license-policy.ts';

const EXCEPTIONS_FILE = 'packages/tooling/license-exceptions.json';
const DEFAULT_MAPS = 'dist-audit/*/_expo/static/js/ios/*.map';

type SourceMap = { readonly sources: readonly string[] };
type PackageJson = { readonly name?: string; readonly license?: unknown };

function readPackage(root: string): PackageJson {
  return JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as PackageJson;
}

function shippedLicenses(mapFiles: readonly string[]): ReadonlyMap<string, string | null> {
  const licenses = new Map<string, string | null>();
  for (const mapFile of mapFiles) {
    const map = JSON.parse(readFileSync(mapFile, 'utf8')) as SourceMap;
    const roots = new Set(map.sources.map((source) => packageRootOf(source)));
    for (const root of roots) {
      // Expo writes sources relative to the server root (the repo root), with a leading '/'.
      const absolute = root === null ? null : path.join(process.cwd(), root);
      if (absolute === null || !existsSync(path.join(absolute, 'package.json'))) {
        continue;
      }
      const pkg = readPackage(absolute);
      licenses.set(pkg.name ?? absolute, typeof pkg.license === 'string' ? pkg.license : null);
    }
  }
  return licenses;
}

function main(argv: readonly string[]): number {
  const mapFiles = argv.length > 0 ? argv : globSync(DEFAULT_MAPS);
  if (mapFiles.length === 0) {
    console.error(
      `audit:licenses: no source maps at ${DEFAULT_MAPS}; run npm run audit:network first`,
    );
    return 1;
  }
  const exceptions = existsSync(EXCEPTIONS_FILE)
    ? (JSON.parse(readFileSync(EXCEPTIONS_FILE, 'utf8')) as Record<string, LicenseException>)
    : {};
  const licenses = shippedLicenses(mapFiles);
  const problems = licenseProblems(licenses, exceptions);
  problems.forEach((problem) => {
    console.error(`audit:licenses: ${problem}`);
  });
  console.log(`audit:licenses: ${String(licenses.size)} shipped packages checked`);
  return problems.length === 0 ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
