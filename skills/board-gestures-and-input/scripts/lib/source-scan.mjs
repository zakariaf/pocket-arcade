// source-scan.mjs: small TypeScript source helpers for this skill's checkers (not an entry point).
// Regex-based on purpose: zero dependencies, and every rule is simple enough to read in one line.

import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

/** A file-level 'worklet' directive: the first statement after any leading comments. */
const DIRECTIVE = /^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*['"]worklet['"];/;
/** import/export ... from '...' that is not `import type` / `export type`. */
const VALUE_IMPORT = /^[ \t]*(import|export)\s+(?!type\b)([^'";]*?)\bfrom\s+['"]([^'"]+)['"]/gm;

export function hasWorkletDirective(source) {
  return DIRECTIVE.test(source);
}

/**
 * Value imports of a file: [{ spec, index }]. `import { type A, type B } from` counts as type-only;
 * a side-effect import (`import 'x'`) is ignored.
 */
export function valueImports(source) {
  const out = [];
  for (const match of source.matchAll(VALUE_IMPORT)) {
    const clause = match[2];
    const braces = /\{([^}]*)\}/.exec(clause);
    const outside = clause.replace(/\{[^}]*\}/, '').replace(/[\s,]/g, '');
    const names = braces ? braces[1].split(',').map((name) => name.trim()).filter(Boolean) : [];
    const isTypeOnly = outside === '' && names.length > 0 && names.every((name) => name.startsWith('type '));
    if (!isTypeOnly) out.push({ spec: match[3], index: match.index });
  }
  return out;
}

/** '@e07/<pkg>/<rest>' or a relative path → repo-relative file, or null for an external package. */
export function resolveSpecifier(fromRel, spec) {
  if (spec.startsWith('.')) return posix.normalize(posix.join(posix.dirname(fromRel), spec));
  const match = /^@e07\/([^/]+)\/(.+)$/.exec(spec);
  if (!match) return null;
  const [, pkg, rest] = match;
  const base = ['game-kit', 'shell', 'tooling'].includes(pkg) ? `packages/${pkg}` : `apps/${pkg}`;
  return `${base}/src/${rest}`;
}

/** Reads a repo-relative file, or null when it does not exist. */
export function readRepoFile(root, rel) {
  const abs = join(root, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

/** Text between the parenthesis at `openIndex` and its partner (strings and templates skipped). */
export function balancedParens(source, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return null;
}

/** The opening JSX tag that starts at `index` (up to the first unquoted '>' outside braces). */
export function openingTag(source, index) {
  let depth = 0;
  let quote = null;
  for (let i = index; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return source.slice(index, i + 1);
  }
  return source.slice(index);
}

/** True for colocated tests and test-only folders, which may simulate what runtime code must not do. */
export function isTestFile(rel) {
  return /\.test\.tsx?$/.test(rel) || rel.startsWith('test/') || rel.includes('/__mocks__/');
}
