#!/usr/bin/env node
// plan-dependency.mjs: before adding, upgrading or removing a package, prints the exact commands the
// policy requires for it (npx expo install in every app, or an exact npm install in the right
// workspace, Shell peer, approvals, checks) and fails when the request breaks the policy: banned,
// held back, not in the versions table, or a version other than the table's.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/plan-dependency.mjs <package>[@<version>] --root .

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { bareVersion, declared, excludePattern, installed, isAllowedLicense, loadPolicy, readRepo, todayUtc } from './lib/policy.mjs';
import { createReporter, fail, parseArgs, requireDir, run } from './check-lib.mjs';

const SPEC = {
  name: 'plan-dependency',
  summary: 'Prints the policy-conformant plan for adding, upgrading (<package>@<version>) or removing (--remove) one package, and fails when the request is banned, held back, not in the versions table, or not the table\'s version. With --online (or --npm-view <file>) it also checks the publish age (7-day policy, honouring dated excludes), the licence and the install scripts from npm.',
  usage: '<package>[@<version>] [--root <dir>] [options]',
  options: {
    root: { type: 'string', value: 'dir', default: '.', help: 'The app repo root (default ".")' },
    remove: { type: 'boolean', help: 'Plan the removal of the package instead' },
    online: { type: 'boolean', help: 'Run npm view for the publish date, licence and scripts (network)' },
    'npm-view': { type: 'string', value: 'file', help: 'Use a saved `npm view <pkg>@<v> version time license scripts --json` output instead of the network' },
    today: { type: 'string', value: 'YYYY-MM-DD', help: 'Date for the 7-day age check (default: today, UTC)' },
  },
  positionals: { min: 1, max: 1 },
  details: [
    'Rules: banned do-not-add held-back not-in-table version-differs too-young licence',
    'Companions (packages a row lets float: test-renderer for RNTL, the @typescript-eslint/* packages',
    'for typescript-eslint, react-native-screens for native-stack) are printed and pinned in the plan.',
    'Examples:',
    '  node plan-dependency.mjs expo-haptics --root .',
    '  node plan-dependency.mjs react-native-google-mobile-ads@17.2.0 --root . --online',
    '  node plan-dependency.mjs zustand --root . --remove',
  ].join('\n'),
};

const DAY_MS = 86_400_000;
const REGEX_SPECIAL = /[.+?^${}()|[\]\\/]/g;

function parseRequest(text) {
  const match = /^(@[^@/]+\/[^@]+|[^@]+)(?:@(.+))?$/.exec(text);
  if (!match) fail(`"${text}" is not a package name`, 'Pass <name> or <name>@<version>, for example expo-haptics or zustand@5.0.15.');
  return { name: match[1], version: match[2] ?? null };
}

function whereList(repo, name) {
  return [...repo.manifests].filter(([, m]) => name in installed(m) || name in declared(m).peerDependencies).map(([ws]) => (ws === '' ? 'the root' : ws));
}

function npmFacts(options, name, version) {
  if (options['npm-view']) return JSON.parse(readFileSync(options['npm-view'], 'utf8'));
  if (!options.online) return null;
  const result = spawnSync('npm', ['view', `${name}@${version}`, 'version', 'time', 'license', 'scripts', '--json'], { encoding: 'utf8' });
  if (result.status !== 0) fail(`npm view ${name}@${version} failed: ${(result.stderr || result.stdout).trim().split('\n')[0]}`, 'Check the name and version, and the network.');
  return JSON.parse(result.stdout);
}

/** npm's exclude patterns allow "*" globs ("expo-*", "@expo/*"). */
function globRegex(pattern) {
  const source = pattern.split('*').map((part) => part.replace(REGEX_SPECIAL, (ch) => `\\${ch}`)).join('.*');
  return new RegExp(`^${source}$`);
}

/** Unexpired dated exclude blocks of .npmrc: [{ expires, pattern, regex }]. */
function activeExcludes(npmrc, today) {
  const out = [];
  let expires = null;
  for (const line of (npmrc ?? '').split('\n')) {
    const header = /^# exclude-block expires=(\d{4}-\d{2}-\d{2}) reason=\S/.exec(line);
    const pattern = excludePattern(line);
    if (header) expires = header[1];
    else if (line.trim() === '') expires = null;
    else if (pattern !== null && expires !== null && expires >= today) out.push({ expires, pattern, regex: globRegex(pattern) });
  }
  return out;
}

function checkFacts(facts, request, row, context, add) {
  const { today, npmrc } = context;
  const published = facts.time?.[request.version];
  if (published) {
    const ageDays = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(published)) / DAY_MS);
    console.log(`age      ${request.name}@${request.version} was published ${published.slice(0, 10)} (${ageDays} days before ${today})`);
    const covered = activeExcludes(npmrc, today).find((entry) => entry.regex.test(request.name));
    if (ageDays < 7 && covered) console.log(`covered  by the dated exclude ${covered.pattern} (block expires ${covered.expires})`);
    if (ageDays < 7 && !covered) {
      const expires = new Date(Date.parse(published) + 7 * DAY_MS).toISOString().slice(0, 10);
      add('npm registry', 0, 'too-young', `${request.name}@${request.version} is ${ageDays} days old; min-release-age=7 will refuse it`, `Wait until ${expires}, or (only for a needed fix, with the owner) add "# exclude-block expires=${expires} reason=<link>" with min-release-age-exclude[]=${request.name} to .npmrc.`);
    }
  }
  const shipped = row ? ['apps', 'shell'].includes(row.where) : true;
  if (facts.license !== undefined) {
    console.log(`licence  ${facts.license}`);
    if (shipped && !isAllowedLicense(facts.license)) add('npm registry', 0, 'licence', `${request.name} is licensed ${facts.license}, which is not on the allowlist for shipped code`, 'Choose another package, or ask the owner for an entry in packages/tooling/license-exceptions.json.');
  }
  // Registry installs run preinstall, install and postinstall; prepare runs only for git or local sources.
  const scripts = Object.entries(facts.scripts ?? {}).filter(([key]) => ['preinstall', 'install', 'postinstall'].includes(key));
  console.log(`scripts  ${scripts.length ? `${scripts.map(([key, cmd]) => `${key}: ${cmd}`).join('; ')} (review, then npm approve-scripts ${request.name})` : 'no install scripts'}`);
}

/**
 * The install command(s) for one or more rows that share a workspace and an install method. Expo-
 * managed packages get the versions table's specifier (npx expo install <pkg>@~x.y.z): without one,
 * npx expo install asks Expo's online versions list, which names a patch the day it is published
 * (it wrote ~57.0.20 for expo-constants on 2026-09-29 while the table pinned ~57.0.19).
 */
function installSteps(repo, row, specs, table) {
  const apps = repo.apps.map((app) => `apps/${app}`);
  const expoSpecs = specs.map(([name, version]) => `${name}@${table[name]?.spec ?? version}`).join(' ');
  const pinned = specs.map(([name, version]) => `${name}@${version}`).join(' ');
  if (row.where === 'apps' && row.install === 'expo') return apps.map((ws) => `(cd ${ws} && npx expo install ${expoSpecs})`);
  if (row.where === 'apps') return [`npm install ${pinned} ${apps.map((ws) => `-w ${ws}`).join(' ')}`];
  if (row.where === 'shell') return [`npm install ${pinned} -w packages/shell`];
  if (row.where === 'tooling') return [`npm install -D ${pinned} -w packages/tooling`];
  return [`npm install -D ${pinned}`];
}

/**
 * Rule 4: an app-wide row (native module or app-wide library) is a "*" peer of the Shell, and npm
 * resolves that peer on its own (its newest release, at the root, next to the apps' copy) unless the
 * root overrides pin it at the version the apps install.
 */
function peerStep(name, row) {
  return row.where === 'apps' && !row.appOnly && !['react', 'react-native'].includes(name) ? [`add "${name}": "*" to packages/shell/package.json peerDependencies and "${name}": "${row.version}" to the root package.json overrides (the Shell's "*" peer then resolves to the apps' version, not npm's newest)`] : [];
}

/**
 * Companions ride in on the row's caret range or auto-installed peer, so they are pinned in the same
 * change: overrides first (with the Shell peer of an app-wide companion), then companions with
 * another install method, then one command for the row and the companions it shares a workspace
 * and a method with.
 */
function companionSteps(repo, policy, name, row) {
  const table = policy.versions.packages;
  const before = [];
  const together = [[name, row.version]];
  for (const companion of row.companions ?? []) {
    console.log(`companion ${companion.package} ${companion.version} (${companion.via}): ${companion.why}`);
    const other = table[companion.package];
    const present = [...repo.manifests.values()].some((m) => companion.package in installed(m));
    if (companion.via === 'overrides') {
      before.push(`add "${companion.package}": "${companion.version}" to the root package.json overrides`);
      continue;
    }
    if (present) continue;
    if (!other) {
      before.push(`npm install -D ${companion.package}@${companion.version}`);
      continue;
    }
    before.push(...peerStep(companion.package, other));
    if (other.where === row.where && other.install === row.install) together.unshift([companion.package, companion.version]);
    else before.push(...installSteps(repo, other, [[companion.package, companion.version]], table));
  }
  return { before, together };
}

function planAdd(repo, policy, request, add) {
  const { name } = request;
  const row = policy.versions.packages[name];
  const ban = policy.banned.find((rule) => rule.regex.test(name));
  if (ban) return add(name, 0, 'banned', `${name} is banned: ${ban.reason}`, 'Use the decided alternative named in the reason; never install it.');
  if (policy.versions.doNotAdd[name]) return add(name, 0, 'do-not-add', `${name}: ${policy.versions.doNotAdd[name]}`, 'Do not install it.');
  const held = policy.versions.heldBack.find((entry) => entry.package === name);
  if (held && request.version && !new RegExp(held.allowed).test(bareVersion(request.version))) return add(name, 0, 'held-back', `${name}@${request.version} crosses a held-back major`, `Stay on the pinned line until: ${held.trigger}.`);
  if (!row) return add(name, 0, 'not-in-table', `${name} is not in the versions table`, 'Stop and ask the owner. If approved: check age, licence and install script (--online), add a row to assets/versions.json in the same commit, then plan again.');
  const version = request.version ?? row.version;
  if (bareVersion(version) !== row.version) return add(name, 0, 'version-differs', `the versions table pins ${name} ${row.version}, not ${version}`, 'An upgrade follows references/procedures.md: at least 7 days old, changelog read, all apps together; change the table row in the same commit, then plan again.');
  const present = whereList(repo, name);
  console.log(`package  ${name} ${row.spec} (${row.install === 'expo' ? 'Expo-managed' : 'exact npm pin'}; belongs in ${row.where === 'apps' ? 'every app' : row.where === 'root' ? 'the root devDependencies' : `packages/${row.where}`}) - ${row.why}`);
  console.log(`present  ${present.length ? present.join(', ') : 'nowhere yet'}`);
  const steps = [...peerStep(name, row)];
  const { before, together } = companionSteps(repo, policy, name, row);
  steps.push(...before, ...installSteps(repo, row, together, policy.versions.packages));
  steps.push('npm approve-scripts --allow-scripts-pending   (read any new install script, then npm approve-scripts <pkg>)');
  if (row.install === 'expo') steps.push('in every app: npx expo install --check && npx expo-doctor');
  steps.push('npm run -s knip   (the package must be imported by the code that needed it)');
  steps.push('node ${CLAUDE_SKILL_DIR}/scripts/check-deps-policy.mjs .   (one-version and companion catch a copy that floated in)');
  if (row.native) steps.push('native change: npx expo prebuild --clean and npm run build:ios:sim for every app (the ios-simulator-build skill)');
  steps.forEach((step, index) => console.log(`step ${index + 1}   ${step}`));
  if (steps.some((step) => step.includes('npx expo install ') && step.includes('@'))) console.log('note     keep the @<spec> in each npx expo install: it writes the versions table\'s specifier. A plain npx expo install <pkg> writes whatever Expo\'s online versions list names today, which can be a patch published that day; that patch stays a WARN with its due date in check-deps.ts and moves on that date through the upgrade procedure.');
  return row;
}

function planRemove(repo, policy, request) {
  const present = [...repo.manifests].filter(([, m]) => request.name in installed(m) || request.name in declared(m).peerDependencies);
  if (present.length === 0) console.log(`present  ${request.name} is not declared in any package.json`);
  present.forEach(([ws, m], index) => {
    const isPeer = !(request.name in installed(m));
    console.log(`step ${index + 1}   ${isPeer ? `remove "${request.name}" from ${ws || 'the root'} peerDependencies` : `npm uninstall ${request.name}${ws ? ` -w ${ws}` : ''}`}`);
  });
  const overrides = repo.manifests.get('')?.overrides ?? {};
  const companions = (policy.versions.packages[request.name]?.companions ?? []).filter((companion) => companion.via === 'overrides').map((companion) => companion.package);
  for (const key of [request.name, ...companions].filter((item) => item in overrides)) console.log(`step     remove "${key}" from the root package.json overrides`);
  console.log('then     remove its imports, config plugin entry and Jest mock; delete its row from assets/versions.json; npm approve-scripts --allow-scripts-pending; npm run -s knip; check-deps-policy.mjs .');
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(options.root, 'repo root');
  if (!existsSync(join(root, 'package.json'))) fail(`nothing to check: ${options.root} has no package.json`, 'Point --root at the repo root.');
  const today = options.today ?? todayUtc();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) fail(`--today "${today}" is not YYYY-MM-DD`, 'Pass a date such as 2026-09-28.');
  const request = parseRequest(positionals[0]);
  const policy = loadPolicy();
  const repo = readRepo(root);
  const report = createReporter({ name: 'plan-dependency' });
  const add = (file, line, rule, message, fix) => report.problem({ file, line, rule, message, fix });
  if (options.remove) {
    planRemove(repo, policy, request);
    return report.finish({ checked: 1, unit: 'requests' });
  }
  const row = planAdd(repo, policy, request, add);
  const facts = npmFacts(options, request.name, request.version ?? row?.version ?? 'latest');
  // Without a version (a package outside the table), npm's latest is the one to age-check.
  if (facts) checkFacts(facts, { name: request.name, version: request.version ?? row?.version ?? facts.version }, row, { today, npmrc: repo.npmrc }, add);
  return report.finish({ checked: 1, unit: 'requests' });
});
