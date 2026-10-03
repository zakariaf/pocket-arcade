// packages/tooling/src/quality/check-worklet-boundary.ts
// Pure checker, run by check-worklet-boundary.test.ts inside `npm test` (no CLI entry: modules that
// Jest transforms must not use import.meta).
// UI-thread modules (file-level 'worklet' directive) may import VALUES only from other
// UI-thread modules or from ALLOWED_PACKAGES. Type-only imports are erased and always fine.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const ROOT = process.cwd();
const ALLOWED_PACKAGES = new Set(['react-native-worklets']);
/** Folders whose modules must be UI-thread modules (tests excluded). */
const REQUIRED = [
  /^packages\/game-kit\/src\/(rng|geom|timeline)\/[^/]+\.ts$/,
  /^apps\/[^/]+\/src\/board\/(draw|layout)[^/]*\.ts$/,
  /^apps\/[^/]+\/src\/sim\/.+\.ts$/,
];
const DIRECTIVE = /^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*['"]worklet['"];/;
const VALUE_IMPORT = /^\s*(?:import|export)\s+(?!type\b)[^'";]*?from\s+['"]([^'"]+)['"]/gm;

export type Violation = { readonly file: string; readonly problem: string };

function isWorkletSource(source: string): boolean {
  return DIRECTIVE.test(source);
}

/** Maps a specifier to a repo-relative file, or null for an external package. */
export function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('.')) return normalize(join(dirname(fromFile), specifier));
  const match = /^@e07\/([^/]+)\/(.+)$/.exec(specifier);
  if (match === null) return null;
  const [, pkg = '', rest = ''] = match;
  const base =
    pkg === 'game-kit' || pkg === 'shell' || pkg === 'tooling' ? `packages/${pkg}` : `apps/${pkg}`;
  return `${base}/src/${rest}`;
}

export function checkFile(file: string, read: (path: string) => string): readonly Violation[] {
  const source = read(file);
  const violations: Violation[] = [];
  if (REQUIRED.some((pattern) => pattern.test(file)) && !isWorkletSource(source)) {
    violations.push({ file, problem: "missing file-level 'worklet'; directive" });
  }
  if (!isWorkletSource(source)) return violations;
  for (const [, specifier = ''] of source.matchAll(VALUE_IMPORT)) {
    const target = resolveSpecifier(file, specifier);
    if (target === null) {
      if (!ALLOWED_PACKAGES.has(specifier))
        violations.push({ file, problem: `value import from package ${specifier}` });
    } else if (!isWorkletSource(read(target))) {
      violations.push({ file, problem: `value import from non-worklet module ${target}` });
    }
  }
  return violations;
}

export function sourceFiles(): string[] {
  const roots = ['packages', 'apps'];
  return roots.flatMap((root) =>
    readdirSync(join(ROOT, root), { recursive: true, encoding: 'utf8' })
      .map((path) => relative(ROOT, join(ROOT, root, path)))
      .filter((path) => /\/src\/.+\.tsx?$/.test(path) && !/\.test\.tsx?$|node_modules/.test(path)),
  );
}

export function checkRepo(): readonly Violation[] {
  const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
  return sourceFiles().flatMap((file) => checkFile(file, read));
}
