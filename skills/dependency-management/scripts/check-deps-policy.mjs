#!/usr/bin/env node
// check-deps-policy.mjs: checks every package.json, the lockfile and .npmrc of the app repo against
// the dependency policy: the versions table, exact pins, Expo specifiers, lockstep apps, Shell peers,
// one React, held-back majors, banned packages, dated release-age excludes and approved scripts.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-deps-policy.mjs .

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXACT_VERSION, bareVersion, declared, installed, loadPolicy, lockName, moduleMapFor, npmrcExcludeProblems, npmrcPolicyOverrides, readRepo, repoSdk, todayUtc } from './lib/policy.mjs';
import { createReporter, fail, parseArgs, requireDir, run, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-deps-policy',
  summary: 'Checks the dependencies of the Pocket Arcade repo: every direct dependency is in the versions table at its pinned spec and in the right workspace, pins are exact (or the specifier npx expo install writes), apps move in lockstep, the Shell lists every native module as a peer, one React, no held-back major, no banned package, the .npmrc policy with dated excludes, a lockfile in sync and approved install scripts.',
  usage: '[repo-root] [options]',
  options: {
    root: { type: 'string', value: 'dir', help: 'The app repo root (same as the positional argument; default ".")' },
    today: { type: 'string', value: 'YYYY-MM-DD', help: 'Date for the exclude expiry check (default: today, UTC)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules: npmrc-policy npmrc-exclude pin-exact expo-spec table-sdk table-version not-in-table',
    '  wrong-workspace every-app lockstep shell-peer overrides peer-override stale-override companion',
    '  held-back do-not-add banned lockfile-missing lockfile-sync install-scripts stale-approval one-react',
    '  one-version license-exceptions unused-dependency (once packages/shell/src exists)',
    '',
    'Example: node check-deps-policy.mjs .      (from the app repo root)',
  ].join('\n'),
};

const rel = (ws) => (ws === '' ? 'package.json' : `${ws}/package.json`);

/** The one command that writes an Expo-managed specifier: the versions table's spec, given explicitly. */
const expoInstall = (ws, name, spec) => `(cd ${ws} && npx expo install ${name}@${spec})`;

/** Why the spec is passed explicitly, and what a same-day Expo patch is. */
const SAME_DAY_PATCH = 'Pass the spec: a plain npx expo install writes what Expo\'s online versions list names today, which can be a patch published that day. Such a patch is a WARN with its due date in check-deps.ts, and it moves on that date through the upgrade procedure (references/procedures.md).';

function checkNpmrc(repo, today, add) {
  if (repo.npmrc === null) return add('.npmrc', 0, 'npmrc-policy', 'is missing', 'Restore the root .npmrc (min-release-age=7, engine-strict=true, save-exact=true).');
  const lines = repo.npmrc.split('\n');
  for (const line of ['min-release-age=7', 'engine-strict=true', 'save-exact=true']) if (!lines.includes(line)) add('.npmrc', 1, 'npmrc-policy', `lacks the line ${line}`, 'Restore the policy line; it is a gated path (Gate-Change trailer).');
  for (const hit of npmrcPolicyOverrides(repo.npmrc)) add('.npmrc', hit.line, 'npmrc-policy', `sets ${hit.key}=${hit.value}; npm keeps the last value of a key, so this switches the policy ${hit.key}=${hit.want} off`, `Delete the line; the policy stays ${hit.key}=${hit.want} (a young release needs a dated exclude block instead).`);
  for (const hit of npmrcExcludeProblems(repo.npmrc, today)) {
    const message = hit.kind === 'expired' ? `exclude ${hit.pattern} sits in a block that expired on ${hit.expires}` : hit.kind === 'bad-header' ? 'exclude-block header must read "# exclude-block expires=YYYY-MM-DD reason=<why>"' : `exclude ${hit.pattern} is not inside a dated exclude block`;
    const fix = hit.kind === 'expired' ? 'Delete the whole block (never extend it); locked versions stay installed.' : 'Put excludes under "# exclude-block expires=<publish date + 7 days> reason=<link or changelog line>".';
    add('.npmrc', hit.line, 'npmrc-exclude', message, fix);
  }
}

function checkManifests(repo, policy, add) {
  const table = policy.versions.packages;
  const { map } = moduleMapFor(repo, policy);
  const sdk = repoSdk(repo);
  const sameSdk = sdk === null || sdk === policy.versions.sdk;
  if (!sameSdk) add('apps/', 0, 'table-sdk', `the apps are on Expo SDK ${sdk} but the versions table is for SDK ${policy.versions.sdk}`, 'Finish the expo-sdk-upgrade runbook: update assets/versions.json of this skill (and its module map) in the same commit as the move.');
  for (const [ws, manifest] of repo.manifests) {
    const file = rel(ws);
    const isApp = ws.startsWith('apps/');
    for (const [name, spec] of Object.entries(installed(manifest))) {
      if (name.startsWith('@e07/')) {
        if (spec !== '*') add(file, 1, 'pin-exact', `${name} is "${spec}"; workspace packages are linked with "*"`, 'Use "*".');
        continue;
      }
      const row = table[name];
      const mapSpec = map[name];
      if (policy.versions.doNotAdd[name]) add(file, 1, 'do-not-add', `${name}: ${policy.versions.doNotAdd[name]}`, `Remove it: npm uninstall ${name}${ws ? ` -w ${ws}` : ''}.`);
      const ban = policy.banned.find((rule) => rule.regex.test(name));
      if (ban) add(file, 1, 'banned', `${name} is banned: ${ban.reason}`, `Remove it: npm uninstall ${name}${ws ? ` -w ${ws}` : ''}, and its imports and plugin entries.`);
      // npx expo install <pkg>@<table spec> writes the module map's specifier, and "~x.y.z" for expo itself.
      const expoManaged = isApp && ((mapSpec !== undefined && spec === mapSpec) || (name === 'expo' && /^~\d+\.\d+\.\d+$/.test(spec)));
      // An Expo-managed package with another specifier is expo-spec's finding (one line, the right command).
      const expoSpecCase = isApp && mapSpec !== undefined && name !== 'expo' && sameSdk;
      if (!EXACT_VERSION.test(spec) && !expoManaged && !expoSpecCase && !(row && spec === row.spec)) add(file, 1, 'pin-exact', `${name} is "${spec}", not an exact version`, isApp && row?.install === 'expo' ? `Run ${expoInstall(ws, name, row.spec)} (it writes "${row.spec}").` : `Pin it exactly: npm install ${name}@${bareVersion(spec)}${ws ? ` -w ${ws}` : ' -D'} (.npmrc has save-exact=true).`);
      if (expoSpecCase && spec !== mapSpec) add(file, 1, 'expo-spec', `${name} is "${spec}", not "${mapSpec}", the specifier of this SDK's module map`, `Run ${expoInstall(ws, name, row?.spec ?? mapSpec)} and keep what it writes. ${SAME_DAY_PATCH}`);
      const held = policy.versions.heldBack.find((entry) => entry.package === name);
      if (held && !new RegExp(held.allowed).test(bareVersion(spec))) add(file, 1, 'held-back', `${name} ${spec} is past a held-back major`, `Stay on the pinned line until: ${held.trigger}.`);
      if (!row) {
        if (!ban && !policy.versions.doNotAdd[name]) add(file, 1, 'not-in-table', `${name} is not in the versions table`, 'A new dependency needs the owner\'s approval and a table row (version at least 7 days old, allowed licence, reviewed install script); see references/procedures.md.');
        continue;
      }
      if (sameSdk && spec !== row.spec) add(file, 1, 'table-version', `${name} is "${spec}" but the versions table pins "${row.spec}"`, `${isApp && row.install === 'expo' ? `Run ${expoInstall(ws, name, row.spec)}` : `Use "${row.spec}"`}, or finish the upgrade procedure and change the table row in the same commit.`);
      const where = ws === '' ? 'root' : ws === 'packages/shell' ? 'shell' : ws === 'packages/tooling' ? 'tooling' : isApp ? 'apps' : 'other';
      if (where !== row.where) add(file, 1, 'wrong-workspace', `${name} belongs in ${row.where === 'apps' ? 'every app' : row.where === 'shell' ? 'packages/shell' : row.where === 'root' ? 'the root devDependencies' : 'packages/tooling'}, not in ${where === 'root' ? 'the root' : ws}`, `Uninstall it here and install it where the table says (${row.install === 'expo' ? `npx expo install ${name}@${row.spec} inside each app` : 'npm install with -w or -D'}).`);
    }
  }
}

function checkApps(repo, policy, add) {
  const table = policy.versions.packages;
  const appManifests = repo.apps.map((app) => [`apps/${app}`, repo.manifests.get(`apps/${app}`)]).filter(([, m]) => m);
  const union = new Set();
  for (const [, m] of appManifests) for (const name of Object.keys(installed(m))) if (table[name]?.where === 'apps') union.add(name);
  for (const [ws, m] of appManifests) {
    for (const name of union) if (!(name in installed(m))) add(rel(ws), 1, 'every-app', `lacks ${name}, which another app uses (every native module is a dependency of every app)`, `Install it in ${ws} with the same specifier (${table[name].install === 'expo' ? expoInstall(ws, name, table[name].spec) : `npm install ${name}@${table[name].version} -w ${ws}`}).`);
  }
  const byName = new Map();
  for (const [ws, m] of appManifests) for (const [name, spec] of Object.entries(installed(m))) if (!name.startsWith('@e07/')) byName.set(name, [...(byName.get(name) ?? []), [ws, spec]]);
  for (const [name, list] of byName) if (new Set(list.map(([, spec]) => spec)).size > 1) add(rel(list[0][0]), 1, 'lockstep', `${name} differs between apps: ${list.map(([ws, spec]) => `${ws}=${spec}`).join(', ')}`, 'Move every app to the same version in one commit.');
  const shell = repo.manifests.get('packages/shell');
  if (shell) {
    const peers = declared(shell).peerDependencies;
    for (const name of union) if (!table[name].appOnly && !(name in peers)) add('packages/shell/package.json', 1, 'shell-peer', `${name} is an app dependency but not a Shell peerDependency`, `Add "${name}": "*" to peerDependencies.`);
  }
  const root = repo.manifests.get('');
  for (const name of ['react', 'react-native']) {
    const pinned = root?.overrides?.[name];
    const used = new Set(appManifests.map(([, m]) => m.dependencies?.[name]).filter(Boolean));
    if (used.size > 0 && (pinned === undefined || [...used].some((spec) => spec !== pinned))) add('package.json', 1, 'overrides', `overrides.${name} is ${pinned ?? 'missing'} but the apps use ${[...used].join(', ')}`, `Set "overrides": { "${name}": "${[...used][0]}" } and change it only together with the apps.`);
  }
  checkPeerOverrides(repo, policy, add);
}

/** App-wide rows the Shell lists as "*" peers (react and react-native have their own rule). */
function shellPeerRows(repo, policy) {
  const peers = declared(repo.manifests.get('packages/shell') ?? {}).peerDependencies;
  const table = policy.versions.packages;
  return Object.keys(peers).filter((name) => table[name]?.where === 'apps' && !table[name].appOnly && !['react', 'react-native'].includes(name)).map((name) => [name, table[name]]);
}

/** Companions pinned through the root overrides, for every row installed somewhere: name -> [version, row name]. */
function overrideCompanions(repo, policy) {
  const out = new Map();
  const direct = new Set([...repo.manifests.values()].flatMap((m) => Object.keys(installed(m))));
  for (const [name, row] of Object.entries(policy.versions.packages)) {
    if (!direct.has(name)) continue;
    for (const companion of row.companions ?? []) if (companion.via === 'overrides') out.set(companion.package, [companion.version, name]);
  }
  return out;
}

/**
 * Rule 4: the Shell's "*" peer of a native module resolves on its own (npm installs the newest
 * release at the root), so every one of them is pinned in the root overrides at the version the
 * apps install; otherwise a second copy sits next to the apps' own. Companions that ride in on a
 * caret range are pinned the same way; any other override is stale.
 */
function checkPeerOverrides(repo, policy, add) {
  const overrides = repo.manifests.get('')?.overrides ?? {};
  const peers = shellPeerRows(repo, policy);
  for (const [name, row] of peers) {
    if (overrides[name] !== row.version) add('package.json', 1, 'peer-override', `overrides.${name} is ${overrides[name] ?? 'missing'}; the Shell's "*" peer needs it pinned at ${row.version}, the version the apps install, or npm puts its newest release at the root next to the apps' copy (two native copies; expo-doctor reports duplicates)`, `Set "overrides": { "${name}": "${row.version}" } in the root package.json, then npm install.`);
  }
  const companions = overrideCompanions(repo, policy);
  for (const [name, [version, owner]] of companions) {
    if (overrides[name] !== version) add('package.json', 1, 'companion', `overrides.${name} is ${overrides[name] ?? 'missing'}; ${owner} ${policy.versions.packages[owner].version} needs it pinned at ${version}`, `Set "overrides": { "${name}": "${version}" } in the root package.json, then npm install (npm ls ${name} must show one version).`);
  }
  const allowed = new Set(['react', 'react-native', ...peers.map(([name]) => name), ...companions.keys()]);
  for (const name of Object.keys(overrides).filter((key) => !allowed.has(key))) add('package.json', 1, 'stale-override', `overrides.${name} is neither a Shell "*" peer of an app-wide row, react, react-native nor a companion of an installed row`, `Remove it from the root overrides (it forces ${overrides[name]} on the whole tree), or add the table row that needs it.`);
}

/** Companions installed with their row, in the same workspace and at the same exact version. */
function checkInstallCompanions(repo, policy, add) {
  const table = policy.versions.packages;
  for (const [ws, manifest] of repo.manifests) {
    const deps = installed(manifest);
    for (const name of Object.keys(deps)) {
      for (const companion of table[name]?.companions ?? []) {
        if (companion.via !== 'install') continue;
        const home = table[companion.package]?.where;
        const where = home === 'apps' && ws.startsWith('apps/') ? ws : home === 'root' ? '' : home === 'shell' ? 'packages/shell' : home === 'tooling' ? 'packages/tooling' : ws;
        const holder = installed(repo.manifests.get(where) ?? {});
        if (!(companion.package in holder)) add(rel(where), 1, 'companion', `${name} ${table[name].version} is installed but its companion ${companion.package} ${companion.version} is not (${companion.why})`, `Install them together: plan-dependency.mjs ${name} prints the command (npm picks the wrong ${companion.package} on its own).`);
      }
    }
  }
}

function checkLockfile(repo, policy, add) {
  if (repo.lockfile === null) return add('package-lock.json', 0, 'lockfile-missing', 'is missing', 'Run npm install once and commit package-lock.json; install fresh clones with npm ci.');
  const packages = repo.lockfile.packages ?? {};
  for (const [ws, manifest] of repo.manifests) {
    const entry = packages[ws];
    const want = installed(manifest);
    if (!entry) add('package-lock.json', 1, 'lockfile-sync', `has no entry for ${ws === '' ? 'the root' : ws}`, 'Run npm install at the root and commit the lockfile.');
    else if (JSON.stringify(installed(entry)) !== JSON.stringify(want)) add('package-lock.json', 1, 'lockfile-sync', `dependencies of ${ws === '' ? 'the root' : ws} differ from its package.json (stale lockfile)`, 'Run npm install at the root, then commit package.json and package-lock.json together.');
  }
  const direct = new Set([...repo.manifests.values()].flatMap((m) => Object.keys(installed(m))));
  for (const path of Object.keys(packages).filter((p) => p.includes('node_modules/'))) {
    const name = lockName(path);
    const ban = policy.banned.find((rule) => rule.regex.test(name));
    if (ban && (ban.scope === 'anywhere' || direct.has(name))) add('package-lock.json', 1, 'banned', `${name} is in the lockfile (${path}): ${ban.reason}`, 'Find what pulls it in (npm explain <pkg>) and remove that dependency.');
  }
  const allow = repo.manifests.get('')?.allowScripts ?? {};
  const versionsOf = (name) => new Set(Object.entries(packages).filter(([path]) => path.includes('node_modules/') && lockName(path) === name).map(([, entry]) => entry.version));
  for (const [path, entry] of Object.entries(packages)) {
    if (!entry.hasInstallScript || !path.includes('node_modules/') || entry.inBundle) continue;
    if (entry.optional && !existsSync(join(repo.root, path))) continue;
    const name = lockName(path);
    if (!Object.keys(allow).some((key) => key === name || key === `${name}@${entry.version}`)) add('package.json', 1, 'install-scripts', `${name}@${entry.version} has an install script that allowScripts does not cover`, `Read it (npm view ${name}@${entry.version} scripts), then npm approve-scripts ${name} or npm deny-scripts ${name}.`);
  }
  for (const key of Object.keys(allow)) {
    const match = /^(@?[^@]+)@(\d+\.\d+\.\d+.*)$/.exec(key);
    if (match && !versionsOf(match[1]).has(match[2]) && versionsOf(match[1]).size > 0) add('package.json', 1, 'stale-approval', `allowScripts approves ${key} but ${[...versionsOf(match[1])].join(', ')} is installed`, `Review the new version's script, then npm approve-scripts ${match[1]} (it rewrites the pin).`);
  }
  for (const name of ['react', 'react-native']) {
    const found = versionsOf(name);
    if (found.size > 1) add('package-lock.json', 1, 'one-react', `${name} is installed as ${[...found].join(', ')}; the tree must hold one version`, 'Fix the root "overrides" and reinstall; npm ls react react-native must show one version each.');
  }
  checkOneVersion(policy, versionsOf, add);
}

/** The release line a caret range stays on: the major, or major.minor below 1.0. */
const lineOf = (version) => {
  const [major, minor] = bareVersion(version).split('.');
  return major === '0' ? `0.${minor}` : major;
};

/**
 * No versions-table package and no companion is installed twice on its own release line (a caret
 * range that floated past the pin: two @typescript-eslint/* copies crash ESLint, two native copies
 * break the build), and a companion never sits at another version than its pin. App-wide rows allow
 * no second copy at all. Older majors that other tools need (globals 14, @types/node 24) are fine.
 */
function checkOneVersion(policy, versionsOf, add) {
  const table = policy.versions.packages;
  const pins = new Map(Object.entries(table).filter(([name]) => !['react', 'react-native'].includes(name)).map(([name, row]) => [name, { version: row.version, strict: ['apps', 'shell'].includes(row.where), owner: null }]));
  for (const [name, row] of Object.entries(table)) for (const companion of row.companions ?? []) if (!pins.has(companion.package)) pins.set(companion.package, { version: companion.version, strict: false, owner: name });
  for (const [name, pin] of pins) {
    const found = [...versionsOf(name)].sort();
    if (found.length === 0) continue;
    const offLine = found.filter((version) => version !== pin.version && (pin.strict || lineOf(version) === lineOf(pin.version)));
    if (offLine.length === 0 || (found.length === 1 && pin.owner === null)) continue;
    const why = pin.owner ? `${pin.owner} needs ${name} ${pin.version}` : `the versions table pins ${pin.version}`;
    add('package-lock.json', 1, 'one-version', `${name} is installed as ${found.join(', ')}; ${why}, so ${offLine.join(', ')} is a second copy that floated in on a range`, `Pin it: "overrides": { "${name}": "${pin.version}" } in the root package.json (or install it at ${pin.version} next to what needs it), npm install, then npm ls ${name} must show one version.`);
  }
}

const CODE_FILE = ['*.ts', '*.tsx', '*.js', '*.mjs', '*.cjs'];
const NOT_CODE = ['ios', 'android', 'build', 'dist', 'coverage', 'reports'];
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/**
 * Every code file that can use an app dependency: the apps, the Shell, game-kit and the root Jest,
 * Babel and Metro configs. Not packages/tooling or eslint.config.mjs: they name SDKs in allow and
 * ban lists without using them.
 */
function codeTexts(root) {
  const texts = [];
  for (const top of ['packages', 'apps']) {
    if (!existsSync(join(root, top))) continue;
    for (const rel of walk(join(root, top), { include: CODE_FILE, ignore: [...NOT_CODE, 'tooling/**'] })) texts.push(readFileSync(join(root, top, rel), 'utf8'));
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) if (entry.isFile() && /^(jest|babel|metro)\b.*\.(ts|js|mjs|cjs)$/.test(entry.name)) texts.push(readFileSync(join(root, entry.name), 'utf8'));
  return texts;
}

/**
 * knip cannot see an unused app-wide native module: the Shell's peer entry counts as a use. So every
 * app-wide row must be imported, required or named (config plugin, Jest setup) by some code file.
 * Runs once the Shell has source code; rows marked implicitUse are used by another package.
 */
function checkUnused(repo, policy, add) {
  if (!existsSync(join(repo.root, 'packages', 'shell', 'src'))) return;
  const table = policy.versions.packages;
  const appNames = new Set(repo.apps.flatMap((app) => Object.keys(installed(repo.manifests.get(`apps/${app}`) ?? {}))));
  const candidates = [...appNames].filter((name) => table[name]?.where === 'apps' && !table[name].appOnly && !table[name].implicitUse && !['expo', 'react', 'react-native'].includes(name));
  if (candidates.length === 0) return;
  const code = codeTexts(repo.root).join('\n');
  for (const name of candidates) {
    if (!new RegExp(`['"\`]${escapeRegex(name)}['"\`/]`).test(code)) add(`apps/${repo.apps[0]}/package.json`, 1, 'unused-dependency', `${name} is a dependency of every app, but no code file, config plugin entry or Jest setup uses it (knip counts the Shell peer entry as a use, so it cannot catch this)`, `Write the code that needs ${name} in the same change, or remove it from every app and from the Shell's peerDependencies.`);
  }
}

function checkLicenseExceptions(repo, add) {
  if (repo.licenseExceptions === null) return;
  for (const [name, entry] of Object.entries(repo.licenseExceptions)) {
    if (typeof entry?.license !== 'string' || !entry.license || typeof entry?.reason !== 'string' || entry.reason.trim().length < 10) add('packages/tooling/license-exceptions.json', 1, 'license-exceptions', `${name} needs an exact "license" and a real "reason"`, 'Write { "license": "<exact SPDX>", "reason": "<why it is acceptable>" }; the owner approves every exception.');
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const target = positionals[0] ?? options.root ?? '.';
  const root = requireDir(target, 'repo root');
  if (!existsSync(join(root, 'package.json'))) fail(`nothing to check: ${target} has no package.json`, 'Run it from the repo root, or pass the root folder: check-deps-policy.mjs <repo-root>.');
  const today = options.today ?? todayUtc();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) fail(`--today "${today}" is not YYYY-MM-DD`, 'Pass a date such as 2026-09-28.');
  const policy = loadPolicy();
  const repo = readRepo(root);
  const report = createReporter({ name: 'check-deps-policy', json: options.json });
  const add = (file, line, rule, message, fix) => report.problem({ file, line, rule, message, fix });
  for (const error of repo.errors) add(error.file, 1, 'lockfile-sync', error.message, 'Fix the JSON (or regenerate the lockfile with npm install).');
  checkNpmrc(repo, today, add);
  checkManifests(repo, policy, add);
  checkApps(repo, policy, add);
  checkInstallCompanions(repo, policy, add);
  checkLockfile(repo, policy, add);
  checkLicenseExceptions(repo, add);
  checkUnused(repo, policy, add);
  return report.finish({ checked: repo.manifests.size, unit: 'package.json files' });
});
