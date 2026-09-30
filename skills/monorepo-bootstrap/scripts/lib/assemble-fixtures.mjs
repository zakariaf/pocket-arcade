// assemble-fixtures.mjs: builds the check-monorepo self-test fixtures in a temporary folder.
// The good fixture is generated from this skill's templates (so the templates are what is tested)
// plus a small lockfile consistent with the generated manifests; each bad-* fixture is that repo
// with the one planted bug described in its mutation.json. Not an entry point.

import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { buildPlan, defaultVars } from './bootstrap-plan.mjs';
import { makeTempDir } from '../check-lib.mjs';

const FIXED_TODAY = '2026-09-28';
const PRE_EXISTING_FOLDER = 'handbook';

function writeFile(root, rel, content) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const deps = (m) => ({ ...(m.dependencies ?? {}), ...(m.devDependencies ?? {}) });

/** A lockfile (v3) that agrees with every generated manifest, as `npm install` would leave it. */
function synthesizeLockfile(root, appId) {
  const rootManifest = readJson(root, 'package.json');
  const packages = { '': { name: rootManifest.name, workspaces: rootManifest.workspaces, devDependencies: rootManifest.devDependencies, engines: rootManifest.engines } };
  for (const ws of ['packages/game-kit', 'packages/shell', 'packages/tooling', `apps/${appId}`]) {
    const m = readJson(root, `${ws}/package.json`);
    packages[ws] = { name: m.name, version: m.version, ...(m.dependencies ? { dependencies: m.dependencies } : {}), ...(m.peerDependencies ? { peerDependencies: m.peerDependencies } : {}) };
    packages[`node_modules/${m.name}`] = { resolved: ws, link: true };
  }
  packages['node_modules/react'] = { version: '19.2.3', license: 'MIT' };
  packages['node_modules/react-native'] = { version: '0.86.3', license: 'MIT' };
  packages['node_modules/lefthook'] = { version: '2.1.14', dev: true, hasInstallScript: true, license: 'MIT' };
  packages['node_modules/fsevents'] = { version: '2.3.3', optional: true, hasInstallScript: true, os: ['darwin'], license: 'MIT' };
  return { name: rootManifest.name, lockfileVersion: 3, requires: true, packages };
}

/** Generate the installed good repo into dir. */
function generateGood(dir) {
  mkdirSync(join(dir, PRE_EXISTING_FOLDER), { recursive: true });
  writeFileSync(join(dir, PRE_EXISTING_FOLDER, 'notes.md'), '# Notes that existed before the monorepo\n');
  const vars = defaultVars('line-siege', FIXED_TODAY);
  for (const entry of buildPlan(dir, vars)) writeFile(dir, entry.rel, entry.content);
  const manifest = readJson(dir, 'package.json');
  manifest.allowScripts = { 'lefthook@2.1.14': true };
  writeFile(dir, 'package.json', `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(dir, 'package-lock.json', `${JSON.stringify(synthesizeLockfile(dir, vars.appId), null, 2)}\n`);
}

function setPath(object, path, value) {
  let node = object;
  for (const key of path.slice(0, -1)) node = node[key] ??= {};
  if (value === null) delete node[path.at(-1)];
  else node[path.at(-1)] = value;
}

/** Apply one fixture's planted bug. Every op must apply, so a stale fixture fails loudly. */
function applyMutation(dir, ops, label) {
  for (const op of ops) {
    if (op.replace) {
      const { file, find, with: replacement } = op.replace;
      const text = readFileSync(join(dir, file), 'utf8');
      if (!text.includes(find)) throw new Error(`${label}: "${find}" not found in ${file}; update its mutation.json`);
      writeFile(dir, file, text.replace(find, replacement));
    } else if (op.json) {
      const data = readJson(dir, op.json.file);
      setPath(data, op.json.path, op.json.value);
      writeFile(dir, op.json.file, `${JSON.stringify(data, null, 2)}\n`);
    } else if (op.write) {
      writeFile(dir, op.write.file, op.write.content);
    } else if (op.delete) {
      if (!existsSync(join(dir, op.delete))) throw new Error(`${label}: ${op.delete} does not exist; update its mutation.json`);
      rmSync(join(dir, op.delete), { recursive: true });
    } else {
      throw new Error(`${label}: unknown op ${JSON.stringify(op)}`);
    }
  }
}

/**
 * Build <tmp>/good and <tmp>/bad-* from tests/fixtures/check-monorepo/<case>/mutation.json
 * (plus each case's EXPECT.txt). Returns the temporary folder; remove it with rmSync.
 */
export function assembleCheckFixtures(sourceDir) {
  const tmp = makeTempDir('check-monorepo-fixtures-');
  const base = join(tmp, '.base');
  mkdirSync(base);
  generateGood(base);
  for (const name of readdirSync(sourceDir).filter((entry) => entry === 'good' || entry.startsWith('bad-'))) {
    const target = join(tmp, name);
    cpSync(base, target, { recursive: true });
    const mutation = join(sourceDir, name, 'mutation.json');
    if (existsSync(mutation)) applyMutation(target, JSON.parse(readFileSync(mutation, 'utf8')), name);
    const expect = join(sourceDir, name, 'EXPECT.txt');
    if (existsSync(expect)) copyFileSync(expect, join(target, 'EXPECT.txt'));
  }
  rmSync(base, { recursive: true });
  return tmp;
}
