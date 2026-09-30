// repo-read.mjs: small readers for the files check-monorepo.mjs inspects (JSON with comments,
// .npmrc, package manifests). Not an entry point.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Strip // and /* comments and trailing commas outside strings, then JSON.parse (tsconfig style). */
export function parseJsonc(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += ch;
      i += 1;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

/** { ok: true, value } or { ok: false, error } for a JSON (or JSONC) file. */
export function readJsonFile(abs, { jsonc = false } = {}) {
  if (!existsSync(abs)) return { ok: false, error: 'missing' };
  try {
    const text = readFileSync(abs, 'utf8');
    return { ok: true, value: jsonc ? parseJsonc(text) : JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: `not valid JSON (${error.message.split('\n')[0]})` };
  }
}

export function readTextFile(abs) {
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

/** Workspace folders under apps/ or packages/ that hold a package.json. */
export function workspaceFolders(root, kind) {
  const dir = join(root, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'package.json')))
    .map((entry) => entry.name)
    .sort();
}

/** 1-based line of the first line matching a regex, or 1. */
export function lineMatching(text, regex) {
  const index = text.split('\n').findIndex((line) => regex.test(line));
  return index === -1 ? 1 : index + 1;
}

/** One `key=value` line of an .npmrc as npm reads it (spaces around "=" allowed), or null. */
const NPMRC_SETTING = /^\s*([^\s=#;][^\s=]*)\s*=\s*(.*?)\s*$/;
const EXCLUDE_KEY = /^min-release-age-exclude(\[\])?$/;

/** The three policy lines. npm keeps the LAST value of a key, so a later line can switch one off. */
export const NPMRC_POLICY = Object.freeze({ 'min-release-age': '7', 'engine-strict': 'true', 'save-exact': 'true' });

/** Lines that set a policy key to anything but its policy value (for example a later min-release-age=0). */
export function npmrcPolicyOverrides(text) {
  const out = [];
  text.split('\n').forEach((line, index) => {
    const setting = NPMRC_SETTING.exec(line);
    const want = setting ? NPMRC_POLICY[setting[1]] : undefined;
    if (want !== undefined && setting[2] !== want) out.push({ line: index + 1, key: setting[1], value: setting[2], want });
  });
  return out;
}

/**
 * Dated exclude blocks of an .npmrc: every exclude must sit in a block that has not expired. Every
 * spelling npm accepts counts as an exclude ("min-release-age-exclude[]=x", "min-release-age-exclude = x").
 */
export function npmrcExcludeProblems(text, todayIso) {
  const problems = [];
  let expires = null;
  text.split('\n').forEach((line, index) => {
    const header = /^# exclude-block expires=(\d{4}-\d{2}-\d{2}) reason=\S.*$/.exec(line);
    const setting = NPMRC_SETTING.exec(line);
    const pattern = setting && EXCLUDE_KEY.test(setting[1]) ? setting[2] : null;
    if (header) expires = header[1];
    else if (line.trim() === '') expires = null;
    else if (pattern !== null && expires === null) problems.push({ line: index + 1, pattern, kind: 'no-block' });
    else if (pattern !== null && expires < todayIso) problems.push({ line: index + 1, pattern, kind: 'expired', expires });
  });
  return problems;
}

/** Exact semver like 1.2.3 or 1.2.3-rc.1 (what save-exact writes). */
export const EXACT_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
