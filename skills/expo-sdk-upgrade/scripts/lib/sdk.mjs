// sdk.mjs: shared helpers for this skill's checkers: read the app repo's manifests, pick the Expo
// module map for an SDK, load the per-SDK expectations, compare versions. Not an entry point:
// nothing runs on import.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets');
const DAY_MS = 86_400_000;

const readJson = (abs) => JSON.parse(readFileSync(abs, 'utf8'));

/** Parses a JSON file, or returns { error } so the caller can report it as a problem. */
export function readJsonSafe(abs) {
  if (!existsSync(abs)) return { value: null, error: 'missing' };
  try {
    return { value: readJson(abs), error: null };
  } catch (error) {
    return { value: null, error: `not valid JSON (${String(error.message).split('\n')[0]})` };
  }
}

/** The per-SDK expectations (assets/sdk-lines.json). */
export function loadSdkLines() {
  return readJson(join(ASSETS, 'sdk-lines.json')).sdks;
}

/** "~57.0.25" -> "57.0.25"; "^1.2.3" -> "1.2.3". */
export const bare = (spec) => String(spec ?? '').replace(/^[~^=v]+/, '').trim();
export const majorOf = (spec) => Number(bare(spec).split('.')[0]);

/** Numeric compare of two versions (prerelease sorts before its release). */
export function compareVersions(a, b) {
  const [coreA, preA] = bare(a).split('-');
  const [coreB, preB] = bare(b).split('-');
  const partsA = coreA.split('.').map(Number);
  const partsB = coreB.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const diff = (partsA[index] ?? 0) - (partsB[index] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  if (preA === undefined && preB === undefined) return 0;
  if (preA === undefined) return 1;
  if (preB === undefined) return -1;
  return preA < preB ? -1 : preA > preB ? 1 : 0;
}

/** True when a concrete version satisfies "x.y.z", "~x.y.z" or "^x.y.z" (enough for Expo's map). */
export function satisfies(version, spec) {
  const want = bare(spec);
  const [major, minor] = want.split('.').map(Number);
  const got = bare(version);
  const [gotMajor, gotMinor] = got.split('.').map(Number);
  if (String(spec).startsWith('~')) return gotMajor === major && gotMinor === minor && compareVersions(got, want) >= 0;
  if (String(spec).startsWith('^')) return gotMajor === major && compareVersions(got, want) >= 0;
  return got === want;
}

/** True when a version starts with a "major.minor" line such as "19.3". */
export const onLine = (version, line) => bare(version) === line || bare(version).startsWith(`${line}.`);

function folders(root, kind) {
  const dir = join(root, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'package.json')))
    .map((entry) => entry.name)
    .sort();
}

/**
 * The parts of the app repo the checks read: the root and app manifests (keyed "" and "apps/<id>"),
 * the Shell manifest, and JSON errors to report.
 */
export function readRepo(root) {
  const errors = [];
  const load = (rel) => {
    const result = readJsonSafe(join(root, rel));
    if (result.error && result.error !== 'missing') errors.push({ file: rel, message: result.error });
    return result.value;
  };
  const apps = folders(root, 'apps').map((id) => ({ id, ws: `apps/${id}`, manifest: load(`apps/${id}/package.json`) })).filter((app) => app.manifest !== null);
  return { root, errors, rootManifest: load('package.json'), shell: load('packages/shell/package.json'), apps };
}

/** Name -> spec for dependencies and devDependencies of one manifest. */
export const depsOf = (manifest) => ({ ...(manifest?.dependencies ?? {}), ...(manifest?.devDependencies ?? {}) });

/** The Expo SDK major the apps declare (first app with an "expo" dependency), or null. */
export function appsSdk(repo) {
  for (const app of repo.apps) {
    const spec = app.manifest.dependencies?.expo;
    if (spec) return majorOf(spec);
  }
  return null;
}

/**
 * The module map `npx expo install` applies for an SDK: the installed expo's
 * bundledNativeModules.json when node_modules holds that SDK, else this skill's copy.
 */
export function moduleMapFor(root, sdk) {
  const installed = join(root, 'node_modules', 'expo');
  if (existsSync(join(installed, 'bundledNativeModules.json')) && existsSync(join(installed, 'package.json'))) {
    const version = readJsonSafe(join(installed, 'package.json')).value?.version;
    if (version && majorOf(version) === sdk) return { map: readJson(join(installed, 'bundledNativeModules.json')), source: `node_modules/expo (expo ${version})` };
  }
  for (const name of [`expo-sdk-${sdk}-module-map.json`, `expo-sdk-${sdk}-preview-module-map.json`]) {
    if (existsSync(join(ASSETS, name))) return { map: readJson(join(ASSETS, name)), source: `the skill's ${name}` };
  }
  return { map: null, source: null };
}

/** Whole days from an ISO timestamp to the start of `todayIso` (UTC). */
export function ageDays(publishedIso, todayIso) {
  return Math.floor((Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(publishedIso)) / DAY_MS);
}

/**
 * The first UTC day that starts at least `days` days after `publishedIso`: from that day on, a
 * `min-release-age=<days>` install accepts the release all day long.
 */
export function firstDayAtAge(publishedIso, days) {
  const ready = Date.parse(publishedIso) + days * DAY_MS;
  return new Date(Math.ceil(ready / DAY_MS) * DAY_MS).toISOString().slice(0, 10);
}

/** True when the release is at least `days` days old for the whole of `todayIso`. */
export const isOldEnough = (publishedIso, todayIso, days) => todayIso >= firstDayAtAge(publishedIso, days);

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}
