#!/usr/bin/env node
// check-sdk-trigger.mjs: answers "is an Expo SDK move due for this repo?".
//   RESULT: PASS (exit 0)  no move is due. Either the next SDK is not npm "latest" yet, or it (or a
//                          package the repo takes from its module map, or an @react-native tool that
//                          follows React Native) is missing or younger than 7 days. Each reason is a
//                          "wait" line with the day it can change; "verdict" says to stay.
//   RESULT: FAIL (exit 1)  [upgrade-due]: every trigger condition holds and the apps are still on
//                          the older SDK, so the move is due and not yet done. The "plan" lines say
//                          how. After the move the same command prints PASS again.
//   exit 2                 no facts: pass --online (npm) or --facts <file> (a saved facts file).
// The third condition (everything green on a branch) is the runbook.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-trigger.mjs . --online

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { appsSdk, bare, depsOf, firstDayAtAge, isOldEnough, loadSdkLines, majorOf, readRepo, todayUtc } from './lib/sdk.mjs';
import { createReporter, fail, parseArgs, requireDir, requireFile, run } from './check-lib.mjs';

const SPEC = {
  name: 'check-sdk-trigger',
  summary: 'Answers whether an Expo SDK move is due. PASS (exit 0): no move is due, and each "wait" line says why (the next SDK is not npm "latest" yet, or it, a package the repo uses from its module map, or @react-native/jest-preset or @react-native/eslint-plugin at its React Native version is missing or younger than 7 days) with the day it can change. FAIL [upgrade-due] (exit 1): every trigger condition holds and the apps are still on the older SDK; the plan lines say how to move. Facts come from npm (--online) or a saved facts file (--facts); without either it exits 2.',
  usage: '[repo-root] (--online | --facts <file>) [options]',
  options: {
    root: { type: 'string', value: 'dir', help: 'The app repo root (same as the positional argument; default ".")' },
    target: { type: 'string', value: 'n', help: 'The SDK major to judge (default: the apps\' SDK + 1)' },
    online: { type: 'boolean', help: 'Read dist-tags, publish times and the target module map from npm (network)' },
    facts: { type: 'string', value: 'file', help: 'Use a saved facts file instead of the network (see --save-facts)' },
    'save-facts': { type: 'string', value: 'file', help: 'With --online: also write the facts to this file (evidence for the report)' },
    today: { type: 'string', value: 'YYYY-MM-DD', help: 'Date for the 7-day checks (default: today, UTC)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Outcomes: PASS = no move due (wait reasons: target-stable target-age package-missing package-age);',
    '          FAIL [upgrade-due] = the move is due and not yet done; exit 2 = no facts or bad input.',
    'Example: node check-sdk-trigger.mjs . --online --save-facts reports/sdk-trigger.json',
    'Facts file: { "distTags": {...}, "expoTimes": { "<version>": "<iso>" }, "moduleMap": {...},',
    '              "packageTimes": { "<package>": { "<version>": "<iso>" } } }',
    'A target older than npm "latest" is judged on its own "sdk-<n>" dist-tag (one SDK at a time).',
  ].join('\n'),
};

const RN_TOOLS = ['@react-native/jest-preset', '@react-native/eslint-plugin'];

function npmJson(args) {
  const result = spawnSync('npm', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) fail(`npm ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim().split('\n')[0]}`, 'Check the network and the package name, or use --facts.');
  return JSON.parse(result.stdout);
}

/** The target expo's bundledNativeModules.json, read from its npm tarball. */
function fetchModuleMap(version) {
  const dir = mkdtempSync(join(tmpdir(), 'sdk-trigger-'));
  try {
    const pack = spawnSync('npm', ['pack', `expo@${version}`, '--pack-destination', dir, '--silent'], { encoding: 'utf8' });
    if (pack.status !== 0) fail(`npm pack expo@${version} failed`, 'Check the network, or use --facts.');
    const tgz = readdirSync(dir).find((name) => name.endsWith('.tgz'));
    const untar = spawnSync('tar', ['-xzf', join(dir, tgz), '-C', dir, 'package/bundledNativeModules.json'], { encoding: 'utf8' });
    if (untar.status !== 0) fail(`could not read bundledNativeModules.json from expo@${version}`, 'Use --facts with the map copied by hand.');
    return JSON.parse(readFileSync(join(dir, 'package', 'bundledNativeModules.json'), 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The stable expo version of the target SDK, or null while it has none: npm "latest" when it is on
 * the target major; the target's own "sdk-<n>" dist-tag when "latest" has already moved past it.
 */
function targetVersion(distTags, target) {
  const latest = distTags?.latest;
  if (!latest) return null;
  if (majorOf(latest) === target) return latest;
  if (majorOf(latest) > target) return distTags[`sdk-${target}`] ?? null;
  return null;
}

function usedNames(repo, map) {
  const names = new Set();
  for (const manifest of [repo.rootManifest, repo.shell, ...repo.apps.map((app) => app.manifest)]) for (const name of Object.keys(depsOf(manifest))) if (name in map) names.add(name);
  for (const core of ['react', 'react-native']) if (core in map) names.add(core);
  return [...names].sort();
}

function onlineFacts(repo, target) {
  const view = npmJson(['view', 'expo', 'dist-tags', 'time', '--json']);
  const facts = { distTags: view['dist-tags'], expoTimes: view.time, moduleMap: null, packageTimes: {} };
  const version = targetVersion(facts.distTags, target);
  if (!version) return facts;
  facts.moduleMap = fetchModuleMap(version);
  const rootDev = depsOf(repo.rootManifest);
  const names = [...usedNames(repo, facts.moduleMap), ...RN_TOOLS.filter((name) => name in rootDev)];
  for (const name of names) facts.packageTimes[name] = npmJson(['view', name, 'time', '--json']);
  return facts;
}

/** Packages to age-check: name -> the version the target SDK installs. */
function wanted(repo, facts) {
  const map = facts.moduleMap ?? {};
  const out = usedNames(repo, map).map((name) => [name, bare(map[name])]);
  const rn = map['react-native'];
  const rootDev = depsOf(repo.rootManifest);
  if (rn) for (const name of RN_TOOLS.filter((tool) => tool in rootDev)) out.push([name, bare(rn)]);
  return out;
}

/**
 * Every unmet trigger condition as { rule, message, until } (until = the first day it can hold, or
 * null when nobody can say). An empty list means the trigger holds.
 */
function waitReasons(repo, facts, context) {
  const { target, version, today } = context;
  const tags = facts.distTags ?? {};
  if (!version) return [{ rule: 'target-stable', message: `SDK ${target} is not stable yet: expo "latest" is ${tags.latest ?? 'unknown'}${tags.next ? ` (next: ${tags.next})` : ''}; betas, previews and "next" releases are never adopted`, until: null }];
  const reasons = [];
  const published = facts.expoTimes?.[version];
  if (!published) reasons.push({ rule: 'target-age', message: `no publish time for expo ${version} (rerun with --online, or add expoTimes to the facts file)`, until: null });
  else if (!isOldEnough(published, today, 7)) reasons.push({ rule: 'target-age', message: `expo ${version} was published ${published.slice(0, 10)}; it is not 7 days old on ${today} (never add an exclude for an SDK move)`, until: firstDayAtAge(published, 7) });
  if (!facts.moduleMap) reasons.push({ rule: 'package-missing', message: `no module map for expo ${version} (rerun with --online, or add moduleMap, its bundledNativeModules.json, to the facts file)`, until: null });
  for (const [name, want] of facts.moduleMap ? wanted(repo, facts) : []) {
    const time = facts.packageTimes?.[name]?.[want];
    if (!time) reasons.push({ rule: 'package-missing', message: `SDK ${target} expects ${name} ${want}, which npm does not list; an SDK is adopted only when every package it needs is out`, until: null });
    else if (!isOldEnough(time, today, 7)) reasons.push({ rule: 'package-age', message: `${name} ${want} was published ${time.slice(0, 10)}; it is not 7 days old on ${today}`, until: firstDayAtAge(time, 7) });
  }
  return reasons;
}

function printPlan(repo, facts, lines, context) {
  const { target, version } = context;
  const map = facts.moduleMap;
  const rn = bare(map['react-native']);
  const line = lines[String(target)];
  const rootDev = depsOf(repo.rootManifest);
  const tools = [
    ...['jest-expo', 'eslint-config-expo'].filter((name) => name in rootDev && map[name]).map((name) => `${name}@${bare(map[name])}`),
    ...RN_TOOLS.filter((name) => name in rootDev).map((name) => `${name}@${rn}`),
    ...(line ? [['@types/react', line.typesReact], ['test-renderer', line.testRenderer]].filter(([name]) => name in rootDev).map(([name, want]) => `${name}@${want}`) : []),
  ];
  console.log(`plan 1   git switch -c chore/expo-sdk-${target}`);
  repo.apps.forEach((app) => console.log(`plan 2   (cd ${app.ws} && npx expo install expo@~${version} && npx expo install --fix)`));
  console.log(`plan 3   npm install -D ${tools.join(' ')}   (one command: jest-expo peers on the new @react-native/jest-preset)`);
  const used = new Set(usedNames(repo, map));
  const peers = Object.keys(repo.shell?.peerDependencies ?? {});
  const pinned = ['react', 'react-native', ...['react-native-reanimated', 'react-native-worklets'].filter((name) => used.has(name)), ...peers, ...Object.keys(repo.rootManifest?.overrides ?? {})];
  const overrides = [...new Set(pinned)].filter((name) => map[name]).map((name) => `"${name}": "<installed, at least ${bare(map[name])}>"`).join(', ');
  console.log(`plan 4   set root "overrides": { ${overrides} } to the exact versions step 2 installed in the apps (npm ls <name>), then npm install; npx expo-doctor in each app must report no duplicate native modules`);
  if (!line) console.log(`plan 5   add an "${target}" entry to assets/sdk-lines.json of this skill (React, test-renderer, @types/react lines, Gesture Handler major, removed APIs) before the alignment check`);
  console.log(`plan 6   code changes from references/sdk-${target}-changes.md (if present), then node \${CLAUDE_SKILL_DIR}/scripts/check-sdk-alignment.mjs .`);
}

/** "wait" lines and the verdict for a repo that stays: the latest day any reason can clear. */
function printWait(reasons, sdk) {
  for (const reason of reasons) console.log(`wait     [${reason.rule}] ${reason.message}${reason.until ? `; possible from ${reason.until}` : ''}`);
  const open = reasons.some((reason) => reason.until === null);
  const latestDay = reasons.map((reason) => reason.until).filter(Boolean).sort().at(-1);
  const when = open ? 'check again at the next session start' : `the trigger can hold from ${latestDay}; check again then`;
  console.log(`verdict  no upgrade due: stay on SDK ${sdk}; ${when}`);
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const rootArg = positionals[0] ?? options.root ?? '.';
  if (!options.online && !options.facts) fail('no facts to judge: pass --online (reads npm) or --facts <file> (a facts file saved with --online --save-facts)', 'Run: node check-sdk-trigger.mjs . --online --save-facts reports/sdk-trigger.json');
  const repo = readRepo(requireDir(rootArg, 'repo root'));
  if (repo.apps.length === 0) fail(`nothing to check: ${rootArg} has no apps/<id>/package.json`, 'Run it from the monorepo root, or pass the root folder.');
  const sdk = appsSdk(repo);
  if (sdk === null) fail('no app declares an "expo" dependency', 'Pass the monorepo root.');
  const target = options.target === undefined ? sdk + 1 : Number(options.target);
  if (!(target > sdk)) fail(`the apps are already on SDK ${sdk}; --target ${options.target} is not later`, `Pass --target ${sdk + 1} for the next move, or leave --target out.`);
  const today = options.today ?? todayUtc();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) fail(`--today "${today}" is not YYYY-MM-DD`, 'Pass a date such as 2026-11-02.');
  const facts = options.facts ? JSON.parse(readFileSync(requireFile(options.facts, 'facts file'), 'utf8')) : onlineFacts(repo, target);
  if (options.online && options['save-facts']) {
    // reports/ is gitignored and may not exist yet in a fresh clone.
    mkdirSync(dirname(options['save-facts']), { recursive: true });
    writeFileSync(options['save-facts'], `${JSON.stringify(facts, null, 2)}\n`);
  }
  const tags = facts.distTags ?? {};
  // A verdict needs npm's "latest": without it "no move due" would be a guess.
  if (!tags.latest) fail('the facts hold no expo "latest" dist-tag', 'Rerun with --online, or save the facts with --online --save-facts <file>.');
  const report = createReporter({ name: 'check-sdk-trigger', json: options.json });
  const version = targetVersion(tags, target);
  console.log(`sdk      apps on Expo SDK ${sdk}; target SDK ${target}${version && version !== tags.latest ? ` (expo ${version}, dist-tag sdk-${target})` : ''}; npm latest ${tags.latest ?? 'unknown'}${tags.next ? `, next ${tags.next}` : ''}`);
  const checks = version && facts.moduleMap ? wanted(repo, facts) : [];
  for (const [name, want] of checks) console.log(`package  ${name} ${want}${facts.packageTimes?.[name]?.[want] ? ` (published ${facts.packageTimes[name][want].slice(0, 10)})` : ''}`);
  if (!version && majorOf(tags.latest) > target) {
    report.problem({ file: 'apps/*/package.json', line: 0, rule: 'upgrade-due', message: `expo "latest" is ${tags.latest}, past SDK ${target}, and the facts hold no "sdk-${target}" dist-tag: the apps on SDK ${sdk} are overdue for a move`, fix: `Rerun with --online (npm keeps an "sdk-${target}" tag for every SDK), then move one SDK at a time.` });
    return report.finish({ checked: 1, unit: 'trigger conditions and packages' });
  }
  const reasons = waitReasons(repo, facts, { target, version, today });
  if (reasons.length > 0) {
    printWait(reasons, sdk);
    return report.finish({ checked: 2 + checks.length, unit: 'trigger conditions and packages' });
  }
  report.problem({ file: 'apps/*/package.json', line: 0, rule: 'upgrade-due', message: `SDK ${target} (expo ${version}) meets the trigger and every app is still on SDK ${sdk}: the move is due and not yet done`, fix: 'Tell the owner (message 2 of the report example), then follow the plan lines on a branch (runbook steps 5 to 16). The move is done when check-sdk-alignment.mjs prints RESULT: PASS and this check prints RESULT: PASS again.' });
  console.log(`trigger  met: expo ${version} is stable and at least 7 days old, and so is every package the repo takes from its module map`);
  printPlan(repo, facts, loadSdkLines(), { target, version });
  return report.finish({ checked: 2 + checks.length, unit: 'trigger conditions and packages' });
});
