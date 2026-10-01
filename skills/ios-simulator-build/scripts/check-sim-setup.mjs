#!/usr/bin/env node
// check-sim-setup.mjs: checks the app repo's simulator-build setup before a build is trusted:
// the Metro cache key, the single test-only gate, the Xcode pin, the build script and npm script,
// the scripts the build runs (audit:privacy), simulator safety, and the .gitignore lines for
// generated native folders.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-sim-setup.mjs .
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, lineOf, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { maestroSpawnProblems } from './lib/maestro-spawns.mjs';

const SPEC = {
  name: 'check-sim-setup',
  summary: 'Checks the repo setup that Release simulator builds depend on: metro.config.js cache key, the test-only gate, the Xcode pin, the build:ios:sim script, simulator safety and .gitignore.',
  usage: '[options] [repo-root]',
  options: { json: { type: 'boolean', help: 'Also print the problems as JSON' } },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  metro-cache-key     every apps/<game>/metro.config.js sets config.cacheVersion from EXPO_PUBLIC_APP_VARIANT',
    '  app-config          every apps/<game>/app.config.ts is withShell(gameConfig, process.env)',
    '  test-only-gate      packages/shell/src/app/test-only.ts gates require(test-only-entry) with the literal',
    "                      process.env.EXPO_PUBLIC_APP_VARIANT === 'store' in the same expression",
    '  test-only-import    no other app or Shell file imports or requires test-only-entry',
    '  sentinel            test-only-entry.ts exports TEST_BUILD_SENTINEL = SHELL_TEST_BUILD_ONLY',
    '  entry-public        an export of test-only-entry.ts lacks its /** @public */ tag (only require() in test-only.ts',
    '                      reaches it, so knip with includeEntryExports would report it as unused)',
    '  entry-api-match     a TestOnlyApi member has no export of the same name in test-only-entry.ts (TEST_ONLY.<name>',
    '                      is then undefined at run time: test-only.ts casts the entry, so tsc never compares them), or',
    '                      the entry exports a name TestOnlyApi does not declare',
    '  app-env             packages/shell/src/app-env.d.ts declares EXPO_PUBLIC_APP_VARIANT and process',
    '  variant-rules       packages/shell/src/config/app-variant.ts allows test:[off,test] and store:[off,live]',
    '  xcode-pin           packages/tooling/src/ios/toolchain.ts pins XCODE_VERSION and sets DEVELOPER_DIR, EXPO_NO_TELEMETRY, CI',
    '  scene-support       Xcode 27+ with Expo SDK 57 needs ios.enableSceneSupport in with-shell.ts',
    '  sim-build-args      the simulator build is Release, iphonesimulator, CODE_SIGNING_ALLOWED=NO',
    '  npm-script          root package.json build:ios:sim runs packages/tooling/src/build/build-ios-sim.ts',
    '  build-prereqs       every npm script the build runs (audit:privacy, after each prebuild) exists and its',
    "                      target file exists: privacy-and-network-audit's tooling lands before the first build",
    '  no-xcode-select     tooling never runs xcode-select --switch/-s or sudo',
    '  sim-safety          tooling never shuts down, erases or deletes "all" simulators, and creates only e07-* names',
    '  maestro-device      every spawn of the Maestro binary under packages/tooling/src (build:ios:sim --link, e2e:ios,',
    '                      screenshots:ios, the StoreKit harness) starts with the global --device <udid> and',
    '                      --driver-host-port <port> (maestroGlobalArgs from e2e/maestro-args.ts, a free port per run),',
    '                      never the per-command --udid or a fixed port: another session\'s simulator can answer',
    '  gitignore           .gitignore ignores apps/*/ios/, apps/*/android/, apps/*/build/ and reports/',
  ].join('\n'),
};

const GATE = /process\.env\.EXPO_PUBLIC_APP_VARIANT\s*===\s*'store'\s*\?\s*null\s*:\s*\(?\s*require\(\s*'\.\/test-only-entry\.ts'\s*\)/;
const IGNORE = ['node_modules', 'ios', 'android', 'build', 'dist', '.expo', 'coverage', 'reports', 'tools'];

function read(root, rel) {
  const abs = join(root, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function listApps(root) {
  const apps = join(root, 'apps');
  if (!existsSync(apps)) return [];
  return walk(apps, { include: ['*/package.json'], ignore: IGNORE }).map((rel) => rel.split('/')[0]).filter((game) => !game.includes('.'));
}

function checkApps(ctx) {
  for (const game of ctx.apps) {
    const metroRel = `apps/${game}/metro.config.js`;
    const metro = read(ctx.root, metroRel);
    if (metro === null) ctx.problem(metroRel, 0, 'metro-cache-key', 'metro.config.js is missing', 'Copy templates/apps/game/metro.config.js: without it a store build can reuse test-build transforms.');
    else if (!/cacheVersion\s*=[^\n;]*EXPO_PUBLIC_APP_VARIANT/.test(maskComments(metro))) ctx.problem(metroRel, 1, 'metro-cache-key', 'config.cacheVersion is not keyed on EXPO_PUBLIC_APP_VARIANT', "Set config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test'}`.");
    const configRel = `apps/${game}/app.config.ts`;
    const config = read(ctx.root, configRel);
    if (config === null) ctx.problem(configRel, 0, 'app-config', 'app.config.ts is missing', 'Create it as one statement: export default withShell(gameConfig, process.env);');
    else if (!/export\s+default\s+withShell\(\s*gameConfig\s*,\s*process\.env\s*\)/.test(maskComments(config))) ctx.problem(configRel, 1, 'app-config', 'app.config.ts is not export default withShell(gameConfig, process.env)', 'Keep app.config.ts to that one statement so the variant checks in withShell always run.');
  }
}

function checkGate(ctx) {
  const gateRel = 'packages/shell/src/app/test-only.ts';
  const gate = read(ctx.root, gateRel);
  if (gate === null) ctx.problem(gateRel, 0, 'test-only-gate', 'test-only.ts is missing', 'Copy templates/packages/shell/src/app/test-only.ts.');
  else if (!GATE.test(maskComments(gate))) ctx.problem(gateRel, 1, 'test-only-gate', 'the gate is not the literal EXPO_PUBLIC_APP_VARIANT comparison around require(./test-only-entry.ts)', 'Use the template verbatim: an imported constant (IS_TEST_BUILD) does not remove the module from store bundles.');
  const entryRel = 'packages/shell/src/app/test-only-entry.ts';
  const entry = read(ctx.root, entryRel);
  if (entry === null) ctx.problem(entryRel, 0, 'sentinel', 'test-only-entry.ts is missing', 'Create it; it exports everything test-only plus TEST_BUILD_SENTINEL.');
  else if (!/export\s+const\s+TEST_BUILD_SENTINEL\s*=\s*'SHELL_TEST_BUILD_ONLY'/.test(entry)) ctx.problem(entryRel, 1, 'sentinel', "TEST_BUILD_SENTINEL = 'SHELL_TEST_BUILD_ONLY' is not exported", 'Export it: the store-artifact gate greps release bundles for this exact string.');
  if (entry !== null) checkEntryTags(ctx, entryRel, entry);
  if (entry !== null) checkEntryMatchesApi(ctx, entryRel, entry);
  for (const base of ['packages/shell/src', 'apps']) {
    if (!existsSync(join(ctx.root, base))) continue;
    for (const rel of walk(join(ctx.root, base), { include: ['*.ts', '*.tsx'], ignore: IGNORE })) {
      const full = `${base}/${rel}`;
      if (full === gateRel || full === entryRel) continue;
      const source = maskComments(readFileSync(join(ctx.root, full), 'utf8'));
      const match = /(?:from|require\(|import\()\s*'[^']*test-only-entry(?:\.ts)?'/.exec(source);
      if (match) ctx.problem(full, lineOf(source, match.index), 'test-only-import', 'imports test-only-entry directly', 'Read TEST_ONLY from @e07/shell/app/test-only.ts (TEST_ONLY?.x); only the gate may load the entry.');
    }
  }
}

function checkShellConfig(ctx) {
  const envRel = 'packages/shell/src/app-env.d.ts';
  const env = read(ctx.root, envRel);
  if (env === null || !/EXPO_PUBLIC_APP_VARIANT\??:/.test(env) || !/declare\s+const\s+process\b/.test(env)) ctx.problem(envRel, env === null ? 0 : 1, 'app-env', 'EXPO_PUBLIC_APP_VARIANT or `declare const process` is not declared', "Declare ProcessEnv.EXPO_PUBLIC_APP_VARIANT?: 'test' | 'store' and declare const process (templates/packages/shell/src/app-env.d.ts).");
  const variantRel = 'packages/shell/src/config/app-variant.ts';
  const variant = read(ctx.root, variantRel);
  if (variant === null || !/test:\s*\['off',\s*'test'\]/.test(variant) || !/store:\s*\['off',\s*'live'\]/.test(variant)) ctx.problem(variantRel, variant === null ? 0 : 1, 'variant-rules', 'the allowed ads modes per variant are not test:[off,test] and store:[off,live]', 'Copy templates/packages/shell/src/config/app-variant.ts: test+live and store+test must throw.');
}

function checkTooling(ctx) {
  const toolchainRel = 'packages/tooling/src/ios/toolchain.ts';
  const toolchain = read(ctx.root, toolchainRel);
  const pin = toolchain === null ? null : /export\s+const\s+XCODE_VERSION\s*=\s*'(\d+)\.(\d+)'/.exec(toolchain);
  if (!pin) ctx.problem(toolchainRel, toolchain === null ? 0 : 1, 'xcode-pin', "XCODE_VERSION = '<major>.<minor>' is not pinned", 'Copy templates/packages/tooling/src/ios/toolchain.ts.');
  else if (!['DEVELOPER_DIR', 'EXPO_NO_TELEMETRY', 'CI'].every((name) => toolchain.includes(name))) ctx.problem(toolchainRel, 1, 'xcode-pin', 'the tool environment does not set DEVELOPER_DIR, EXPO_NO_TELEMETRY and CI', 'Build the child-process env with toolEnv() from the template.');
  if (pin && Number(pin[1]) >= 27) checkSceneSupport(ctx);
  const planRel = 'packages/tooling/src/build/sim-build-plan.ts';
  const plan = read(ctx.root, planRel);
  if (plan === null || !['CODE_SIGNING_ALLOWED=NO', "'iphonesimulator'", "'Release'"].every((token) => plan.includes(token))) ctx.problem(planRel, plan === null ? 0 : 1, 'sim-build-args', 'the simulator build is not Release + iphonesimulator + CODE_SIGNING_ALLOWED=NO', 'Copy templates/packages/tooling/src/build/sim-build-plan.ts.');
  if (!existsSync(join(ctx.root, 'packages/tooling/src'))) return;
  const tooling = [];
  for (const rel of walk(join(ctx.root, 'packages/tooling/src'), { include: ['*.ts', '*.mts', '*.sh'] })) {
    const full = `packages/tooling/src/${rel}`;
    const source = maskComments(readFileSync(join(ctx.root, full), 'utf8'));
    for (const [pattern, rule, message, fix] of TOOLING_BANS) {
      const match = pattern.exec(source);
      if (match) ctx.problem(full, lineOf(source, match.index), rule, message, fix);
    }
    if (/\.test\.m?ts$/.test(full) === false && !full.endsWith('.sh')) tooling.push({ rel: full, code: source });
    // Array form after simctl (['simctl', 'create', 'name'] or simctl(['create', 'name'])) and shell
    // form (simctl create "name" ...); a bare ['create', ...] list is not a simctl call.
    for (const match of source.matchAll(/(?:'simctl',\s*|simctl\(\s*\[\s*)'create',\s*'([^']+)'|simctl\s+create\s+(?:"([^"]+)"|'([^']+)'|([^\s"'`]+))/g)) {
      const name = match[1] ?? match[2] ?? match[3] ?? match[4];
      // A variable ($NAME, ${name}) cannot be judged here; simulatorName() guards the TS path.
      if (!name.startsWith('e07-') && !name.startsWith('$')) ctx.problem(full, lineOf(source, match.index), 'sim-safety', `creates a simulator named "${name}"`, 'Name every simulator e07-<purpose> through simulatorName() so cleanup can never touch another agent\'s device.');
    }
  }
  // Every Maestro run names its simulator and its own XCTest driver port before the command.
  for (const found of maestroSpawnProblems(tooling)) ctx.problem(found.file, found.line, 'maestro-device', found.message, found.fix);
}

const TOOLING_BANS = [
  [/xcode-select['"]?\s*,?\s*\[?\s*['"]?\s*(?:-s|--switch)\b|xcode-select\s+(?:-s|--switch)\b/, 'no-xcode-select', 'switches the global Xcode with xcode-select', 'Select Xcode per process with DEVELOPER_DIR (selectXcode()); xcode-select needs sudo and changes every build on the Mac.'],
  [/['"]sudo['"]|\bsudo\s/, 'no-xcode-select', 'runs sudo', 'Tooling never needs sudo; licence acceptance is an owner step.'],
  [/['"](?:shutdown|erase|delete)['"]\s*,\s*['"]all['"]|simctl\s+(?:shutdown|erase|delete)\s+all\b/, 'sim-safety', 'shuts down, erases or deletes all simulators', 'Target one e07-* simulator by UDID; other agents use the other simulators on this Mac.'],
];

function checkSceneSupport(ctx) {
  const usesSdk57 = ctx.apps.some((game) => /"expo":\s*"[~^]?57\./.test(read(ctx.root, `apps/${game}/package.json`) ?? ''));
  const withShellRel = 'packages/shell/src/config/with-shell.ts';
  if (usesSdk57 && !(read(ctx.root, withShellRel) ?? '').includes('enableSceneSupport')) ctx.problem(withShellRel, 0, 'scene-support', 'XCODE_VERSION is 27 or newer on Expo SDK 57 without ios.enableSceneSupport', "Add ['expo-build-properties', { ios: { enableSceneSupport: true } }] to withShell's plugins first; without it the app launches to a black screen on iOS 27.");
}

// The npm scripts build-ios-sim.ts runs (its SIM_BUILD_NPM_SCRIPTS), and who ships their targets.
const BUILD_NPM_SCRIPTS = {
  'audit:privacy': { command: 'node packages/tooling/src/audit/audit-privacy.ts', source: "privacy-and-network-audit's tooling templates (packages/tooling/src/audit/ and packages/tooling/network-audit/)" },
};

function readScripts(root) {
  try {
    return JSON.parse(read(root, 'package.json') ?? '{}').scripts ?? {};
  } catch {
    return {};
  }
}

// The build runs these right after its clean prebuild; a missing target used to fail the first
// build only after a slow prebuild. build-ios-sim.ts now stops before it (exit 2): this is the same check.
function checkBuildPrereqs(ctx, scripts) {
  for (const [name, { command: expected, source }] of Object.entries(BUILD_NPM_SCRIPTS)) {
    const command = scripts[name];
    if (typeof command !== 'string') {
      ctx.problem('package.json', 0, 'build-prereqs', `scripts["${name}"] is missing, and build:ios:sim runs it after every prebuild`, `Add "${name}": "${expected}" and install ${source}.`);
      continue;
    }
    for (const target of command.split(/\s+/).filter((word) => /^[\w@.-]+(\/[\w@.-]+)+\.(ts|mts|js|mjs)$/.test(word))) {
      if (!existsSync(join(ctx.root, target))) ctx.problem(target, 0, 'build-prereqs', `does not exist, and build:ios:sim runs it through "${name}" after every prebuild`, `Install ${source} before the first simulator build.`);
    }
  }
}

/** Each export of the entry (a line, or each name of a multi-line export list) carries @public in the comment above it. */
function checkEntryTags(ctx, rel, text) {
  const lines = text.split('\n');
  const taggedAbove = (index) => {
    for (let i = index - 1; i >= 0; i -= 1) {
      const line = lines[i].trim();
      if (line === '' || line === '{' || /^export\s*\{$/.test(line)) return false;
      if (/@public\b/.test(line)) return true;
      if (!/^(\/\*\*|\*|\*\/|\/\/)/.test(line)) return false;
    }
    return false;
  };
  let inList = false;
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (/^export\s*\{\s*$/.test(line)) {
      inList = true;
      return;
    }
    if (inList) {
      if (/^\}/.test(line)) inList = false;
      else if (/^[A-Za-z_$][\w$]*,?$/.test(line) && !taggedAbove(index)) ctx.problem(rel, index + 1, 'entry-public', `export ${line.replace(',', '')} has no /** @public */ tag`, 'Put /** @public */ on the line above it: only require() in test-only.ts reaches this export, so knip (includeEntryExports) would report it.');
      return;
    }
    if (/^export\s/.test(line) && !taggedAbove(index)) ctx.problem(rel, index + 1, 'entry-public', `${line.slice(0, 60)} has no /** @public */ tag`, 'Put /** @public */ on the line above it: only require() in test-only.ts reaches this export, so knip (includeEntryExports) would report it.');
  });
}

/** Names test-only-entry.ts exports: export { a, b } from ..., export const X. */
function entryExports(entry) {
  const code = maskComments(entry);
  const names = new Set();
  for (const match of code.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name !== '') names.add(name);
    }
  }
  for (const match of code.matchAll(/export\s+(?:const|function|let)\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  return names;
}

/**
 * TEST_ONLY is require('./test-only-entry.ts') cast to TestOnlyApi, so tsc never compares the two:
 * a member without an export of the same name is undefined at run time (TEST_ONLY.x() throws), and
 * an export without a member is unreachable. The shared pair is edited together.
 */
function checkEntryMatchesApi(ctx, entryRel, entry) {
  const apiRel = 'packages/shell/src/app/test-only-api.ts';
  const api = read(ctx.root, apiRel);
  if (api === null) {
    ctx.problem(apiRel, 0, 'entry-api-match', 'test-only-api.ts is missing', 'Copy templates/packages/shell/src/app/test-only-api.ts with the entry: the two are one shared pair.');
    return;
  }
  const body = /export\s+type\s+TestOnlyApi\s*=\s*\{([\s\S]*?)\n\};/.exec(maskComments(api))?.[1] ?? '';
  const members = new Set([...body.matchAll(/^\s*readonly\s+([A-Za-z_$][\w$]*)\s*\??:/gm)].map((match) => match[1]));
  const exported = entryExports(entry);
  for (const name of [...members].filter((member) => !exported.has(member))) ctx.problem(entryRel, 1, 'entry-api-match', `TestOnlyApi.${name} has no export of that name, so TEST_ONLY.${name} is undefined at run time`, `Export it here, tagged /** @public */, once its file exists; until then leave the member out of test-only-api.ts too (copy the shared pair from templates/packages/shell/src/app/).`);
  for (const name of [...exported].filter((exportName) => !members.has(exportName))) ctx.problem(apiRel, 1, 'entry-api-match', `test-only-entry.ts exports ${name}, but TestOnlyApi declares no member of that name, so no code can reach it through TEST_ONLY`, 'Add the member with its type to TestOnlyApi in the same change (the two files are one shared pair).');
}

function checkRepoFiles(ctx) {
  const scripts = readScripts(ctx.root);
  const script = scripts['build:ios:sim'];
  if (script !== 'node packages/tooling/src/build/build-ios-sim.ts') ctx.problem('package.json', 0, 'npm-script', `scripts["build:ios:sim"] is ${JSON.stringify(script ?? null)}`, 'Set it to exactly "node packages/tooling/src/build/build-ios-sim.ts".');
  checkBuildPrereqs(ctx, scripts);
  const gitignore = read(ctx.root, '.gitignore') ?? '';
  const lines = new Set(gitignore.split('\n').map((line) => line.trim()));
  for (const entry of ['apps/*/ios/', 'apps/*/android/', 'apps/*/build/', 'reports/']) {
    if (!lines.has(entry)) ctx.problem('.gitignore', 0, 'gitignore', `does not ignore ${entry}`, `Add the line ${entry}: ios/ and android/ are regenerated by every prebuild and build/ holds DerivedData.`);
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const report = createReporter({ name: 'check-sim-setup', json: options.json });
  const apps = listApps(root);
  const ctx = { root, apps, problem: (file, line, rule, message, fix) => report.problem({ file, line, rule, message, fix }) };
  if (apps.length === 0 && !existsSync(join(root, 'packages'))) return report.finish({ checked: 0, unit: 'apps and packages' });
  checkApps(ctx);
  checkGate(ctx);
  checkShellConfig(ctx);
  checkTooling(ctx);
  checkRepoFiles(ctx);
  return report.finish({ checked: apps.length, unit: 'apps (plus the shared Shell and tooling setup)' });
});
