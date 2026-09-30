// policy.mjs: loads this skill's dependency policy (versions table, banned list, Expo module map)
// and reads the manifests, lockfile and .npmrc of an app repo. Shared by check-deps-policy.mjs
// and plan-dependency.mjs. Not an entry point: no side effects on import.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets');

export const EXACT_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
export const ALLOWED_LICENSES = ['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'OFL-1.1', 'CC0-1.0'];

const readJson = (abs) => JSON.parse(readFileSync(abs, 'utf8'));

/** The versions table, the banned list and the SDK 57 module map from assets/. */
export function loadPolicy() {
  const versions = readJson(join(ASSETS, 'versions.json'));
  const banned = readJson(join(ASSETS, 'banned-packages.json')).packages.map((rule) => ({ ...rule, regex: new RegExp(rule.pattern) }));
  const moduleMap = readJson(join(ASSETS, `expo-sdk-${versions.sdk}-module-map.json`));
  return { versions, banned, moduleMap };
}

/** "~57.0.25" -> "57.0.25"; "^1.2.3" -> "1.2.3". */
export const bareVersion = (spec) => String(spec).replace(/^[~^=v]+/, '');
export const majorOf = (spec) => Number(bareVersion(spec).split('.')[0]);

/** True when an SPDX expression is acceptable: an OR needs one allowed side, an AND needs both. */
export function isAllowedLicense(expression) {
  const cleaned = String(expression ?? '').replace(/[()]/g, '').trim();
  if (cleaned.includes(' OR ')) return cleaned.split(' OR ').some((part) => isAllowedLicense(part));
  if (cleaned.includes(' AND ')) return cleaned.split(' AND ').every((part) => isAllowedLicense(part));
  return ALLOWED_LICENSES.includes(cleaned);
}

function readJsonIfPresent(abs) {
  if (!existsSync(abs)) return { ok: false, error: 'missing' };
  try {
    return { ok: true, value: readJson(abs) };
  } catch (error) {
    return { ok: false, error: `not valid JSON (${error.message.split('\n')[0]})` };
  }
}

function folders(root, kind) {
  const dir = join(root, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'package.json')))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Everything the checks read from an app repo: manifests keyed by workspace path ('' is the root),
 * the lockfile, .npmrc text and license exceptions. Missing files are null.
 */
export function readRepo(root) {
  const manifests = new Map();
  const errors = [];
  const add = (ws, rel) => {
    const read = readJsonIfPresent(join(root, rel));
    if (read.ok) manifests.set(ws, read.value);
    else if (read.error !== 'missing') errors.push({ file: rel, message: read.error });
  };
  add('', 'package.json');
  const apps = folders(root, 'apps');
  const packages = folders(root, 'packages');
  for (const pkg of packages) add(`packages/${pkg}`, `packages/${pkg}/package.json`);
  for (const app of apps) add(`apps/${app}`, `apps/${app}/package.json`);
  const lock = readJsonIfPresent(join(root, 'package-lock.json'));
  if (!lock.ok && lock.error !== 'missing') errors.push({ file: 'package-lock.json', message: lock.error });
  const exceptions = readJsonIfPresent(join(root, 'packages/tooling/license-exceptions.json'));
  if (!exceptions.ok && exceptions.error !== 'missing') errors.push({ file: 'packages/tooling/license-exceptions.json', message: exceptions.error });
  const npmrcPath = join(root, '.npmrc');
  return {
    root,
    apps,
    packages,
    manifests,
    errors,
    lockfile: lock.ok ? lock.value : null,
    npmrc: existsSync(npmrcPath) ? readFileSync(npmrcPath, 'utf8') : null,
    licenseExceptions: exceptions.ok ? exceptions.value : null,
  };
}

/** The workspace's declared dependencies by kind. */
export function declared(manifest) {
  return {
    dependencies: manifest.dependencies ?? {},
    devDependencies: manifest.devDependencies ?? {},
    optionalDependencies: manifest.optionalDependencies ?? {},
    peerDependencies: manifest.peerDependencies ?? {},
  };
}

/** Name -> spec for dependencies, devDependencies and optionalDependencies (not peers). */
export function installed(manifest) {
  const d = declared(manifest);
  return { ...d.dependencies, ...d.devDependencies, ...d.optionalDependencies };
}

/** The Expo SDK major the apps use (from the "expo" specifier), or null. */
export function repoSdk(repo) {
  for (const app of repo.apps) {
    const spec = repo.manifests.get(`apps/${app}`)?.dependencies?.expo;
    if (spec) return majorOf(spec);
  }
  return null;
}

/**
 * The module map `npx expo install` uses: the installed expo's bundledNativeModules.json when the
 * repo has node_modules, else this skill's copy for the table's SDK.
 */
export function moduleMapFor(repo, policy) {
  const installedMap = join(repo.root, 'node_modules', 'expo', 'bundledNativeModules.json');
  if (existsSync(installedMap)) {
    try {
      return { map: readJson(installedMap), source: 'node_modules/expo/bundledNativeModules.json' };
    } catch {
      // fall through to the skill's copy
    }
  }
  return { map: policy.moduleMap, source: `the skill's SDK ${policy.versions.sdk} module map` };
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

/** The exclude pattern of a line in any spelling npm accepts ("x[]=p", "x = p"), or null. */
export function excludePattern(line) {
  const setting = NPMRC_SETTING.exec(line);
  return setting && EXCLUDE_KEY.test(setting[1]) ? setting[2] : null;
}

/**
 * Dated exclude blocks of an .npmrc: every exclude must sit in a block that has not expired. A
 * header comment that still holds the literal placeholder "expires=YYYY-MM-DD" is documentation.
 */
export function npmrcExcludeProblems(text, todayIso) {
  const problems = [];
  let expires = null;
  text.split('\n').forEach((line, index) => {
    const header = /^# exclude-block expires=(\d{4}-\d{2}-\d{2}) reason=\S.*$/.exec(line);
    const looseHeader = /^#\s*exclude-block\b/.test(line) && !line.includes('expires=YYYY-MM-DD');
    const pattern = excludePattern(line);
    if (header) expires = header[1];
    else if (looseHeader) problems.push({ line: index + 1, pattern: '', kind: 'bad-header' });
    else if (line.trim() === '') expires = null;
    else if (pattern !== null && expires === null) problems.push({ line: index + 1, pattern, kind: 'no-block' });
    else if (pattern !== null && expires < todayIso) problems.push({ line: index + 1, pattern, kind: 'expired', expires });
  });
  return problems;
}

/** Package name from a lockfile path: "node_modules/a/node_modules/@s/b" -> "@s/b". */
export function lockName(path) {
  return path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}
