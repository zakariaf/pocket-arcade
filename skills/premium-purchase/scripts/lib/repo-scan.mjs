// repo-scan.mjs: helpers for reading an app repo (apps/<game>, packages/shell, packages/game-kit,
// packages/tooling). Not an entry point; imported by this skill's checkers.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { maskComments, walk } from '../check-lib.mjs';

/** Every source file of the runtime code: apps/<game>/src, packages/{shell,game-kit}/src (posix, repo-relative). */
export function runtimeSourceFiles(root, { includeTooling = false, extensions = ['*.ts', '*.tsx', '*.js', '*.jsx'] } = {}) {
  const bases = [];
  for (const group of ['apps', 'packages']) {
    const dir = join(root, group);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith('.')) continue;
      if (group === 'packages' && name === 'tooling' && !includeTooling) continue;
      const src = join(dir, name, 'src');
      if (existsSync(src) && statSync(src).isDirectory()) bases.push(`${group}/${name}/src`);
    }
  }
  const files = [];
  for (const base of bases) {
    for (const rel of walk(join(root, base), { include: extensions, ignore: ['ios', 'android', 'build', 'dist'] })) files.push(`${base}/${rel}`);
  }
  return files;
}

/** Config files that feed the native build: apps/<game>/{app.config.ts,app.json,game.config.ts} and packages/shell/src/config/*. */
export function configFiles(root) {
  const files = [];
  const apps = join(root, 'apps');
  if (existsSync(apps)) {
    for (const name of readdirSync(apps).sort()) {
      for (const file of ['app.config.ts', 'app.config.js', 'app.json', 'game.config.ts']) {
        if (existsSync(join(apps, name, file))) files.push(`apps/${name}/${file}`);
      }
    }
  }
  const shellConfig = join(root, 'packages', 'shell', 'src', 'config');
  if (existsSync(shellConfig)) for (const rel of walk(shellConfig, { include: ['*.ts'] })) files.push(`packages/shell/src/config/${rel}`);
  return files;
}

/** package.json files of the root and every workspace (repo-relative). */
export function packageJsonFiles(root) {
  const files = existsSync(join(root, 'package.json')) ? ['package.json'] : [];
  for (const group of ['apps', 'packages']) {
    const dir = join(root, group);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (existsSync(join(dir, name, 'package.json'))) files.push(`${group}/${name}/package.json`);
    }
  }
  return files;
}

export function readRepoText(root, rel) {
  return readFileSync(join(root, rel), 'utf8');
}

export function readRepoJson(root, rel) {
  try {
    return JSON.parse(readRepoText(root, rel));
  } catch {
    return null;
  }
}

export function isTestFile(rel) {
  return /\.(test|golden\.test|sim\.test)\.[jt]sx?$/.test(rel) || rel.includes('/__tests__/') || rel.includes('/testing/');
}

/** 1-based line of a character index. */
export function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

/**
 * Static imports and requires of a module source (comments masked first).
 * Returns [{ specifier, names: string[] (imported binding names, 'default' for a default import), isType, line }].
 */
export function parseImports(source) {
  const text = maskComments(source);
  const out = [];
  const importRe = /\bimport\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(importRe)) {
    const clause = match[2].trim();
    const names = [];
    const braces = /\{([^}]*)\}/.exec(clause);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (name) names.push(name);
      }
    }
    const beforeBraces = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
    if (beforeBraces && !beforeBraces.startsWith('*')) names.push('default');
    if (beforeBraces.startsWith('*')) names.push('*');
    out.push({ specifier: match[3], names, isType: Boolean(match[1]), line: lineAt(text, match.index) });
  }
  for (const match of text.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) out.push({ specifier: match[1], names: [], isType: false, line: lineAt(text, match.index) });
  for (const match of text.matchAll(/\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ specifier: match[1], names: [], isType: false, line: lineAt(text, match.index) });
  for (const match of text.matchAll(/\bexport\s+(?:type\s+)?(?:\{[^}]*\}|\*)\s*from\s*['"]([^'"]+)['"]/g)) out.push({ specifier: match[1], names: [], isType: false, line: lineAt(text, match.index) });
  return out;
}

/** Index of the parenthesis that closes the one at openIndex (text should have comments masked). */
export function matchingParen(text, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Ranges [start, end] of the argument lists of every call to one of the named functions. */
export function callRanges(text, names) {
  const ranges = [];
  const re = new RegExp(`\\b(${names.join('|')})\\s*\\(`, 'g');
  for (const match of text.matchAll(re)) {
    const open = match.index + match[0].length - 1;
    const close = matchingParen(text, open);
    if (close !== -1) ranges.push({ name: match[1], start: open, end: close });
  }
  return ranges;
}
