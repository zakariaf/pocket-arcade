#!/usr/bin/env node
// check-emu-setup.mjs: checks the app repo's Android emulator-build setup before a build is trusted:
// the build:android:emu script and its tooling, the .gitignore line for the generated android/
// folders, the Metro cache key, adb calls that always name their serial, e07-android-* AVD names,
// the JDK 17 pin, no Play Store image, and assembleRelease (never the Play bundle) for the emulator.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-emu-setup.mjs .
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, lineOf, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-emu-setup',
  summary: 'Checks the repo setup that Release emulator builds depend on: the build:android:emu script and tooling, .gitignore, the Metro cache key, adb serials, AVD names, the JDK 17 pin, the emulator image and the Gradle task.',
  usage: '[options] [repo-root]',
  options: { json: { type: 'boolean', help: 'Also print the problems as JSON' } },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  npm-script      root package.json build:android:emu is exactly "node packages/tooling/src/build/build-android-emu.ts"',
    '                  and that file exists',
    '  tooling-files   emu-build-plan.ts, android/toolchain.ts, android/emulators.ts and android/emulator-device.ts exist',
    '  gitignore       .gitignore ignores apps/*/android/, apps/*/build/ and packages/*/android/build/ (prebuild regenerates android/; Gradle builds the Shell module in place)',
    '  metro-cache-key every apps/<game>/metro.config.js sets config.cacheVersion from EXPO_PUBLIC_APP_VARIANT',
    '  adb-serial      every adb call under packages/tooling/src names -s <serial> first (adbArgs()), only',
    '                  `adb devices` and `adb version` may go without; never kill-server (other sessions share adb)',
    '  avd-name        every AVD the tooling creates or starts (--name / -avd literals) is e07-android-*',
    '  jdk-pin         android/toolchain.ts pins JDK_MAJOR = 17 and sets JAVA_HOME, ANDROID_HOME, EXPO_NO_TELEMETRY, CI',
    '  play-image      no google_apis_playstore system image in the tooling (adb root fails there)',
    '  gradle-task     the emulator build assembles the Release APK (assembleRelease); bundleRelease belongs to',
    '                  packages/tooling/src/release-android/ only',
    '',
    'Exit 2 when the folder has no package.json and no apps/ or packages/ (nothing to check).',
  ].join('\n'),
};

const SCRIPT = 'node packages/tooling/src/build/build-android-emu.ts';
const TOOLING_FILES = [
  'packages/tooling/src/build/emu-build-plan.ts',
  'packages/tooling/src/android/toolchain.ts',
  'packages/tooling/src/android/emulators.ts',
  'packages/tooling/src/android/emulator-device.ts',
];
const IGNORE = ['node_modules', 'ios', 'android', 'build', 'dist', '.expo', 'coverage', 'reports'];

function read(root, rel) {
  const abs = join(root, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function checkScriptAndFiles(ctx) {
  let scripts = {};
  try {
    scripts = JSON.parse(read(ctx.root, 'package.json') ?? '{}').scripts ?? {};
  } catch (error) {
    fail(`package.json is not JSON (${error.message})`, 'Fix the root package.json.');
  }
  const script = scripts['build:android:emu'];
  if (script !== SCRIPT) ctx.problem('package.json', 0, 'npm-script', `scripts["build:android:emu"] is ${JSON.stringify(script ?? null)}`, `Set it to exactly "${SCRIPT}" (quality-gates' canonical script line).`);
  const target = SCRIPT.split(' ')[1];
  if (!existsSync(join(ctx.root, target))) ctx.problem(target, 0, 'npm-script', 'does not exist, so npm run build:android:emu cannot start', 'Copy templates/packages/tooling/src/build/build-android-emu.ts.');
  for (const rel of TOOLING_FILES) {
    if (!existsSync(join(ctx.root, rel))) ctx.problem(rel, 0, 'tooling-files', 'is missing', `Copy templates/${rel} (with its test where the skill has one).`);
  }
}

function checkGitignore(ctx) {
  const lines = new Set((read(ctx.root, '.gitignore') ?? '').split('\n').map((line) => line.trim()));
  const reasons = {
    'apps/*/android/': 'prebuild regenerates android/ on every build',
    'apps/*/build/': 'build/ holds the logs and pulled saves',
    'packages/*/android/build/': "Gradle builds the Shell's Kotlin module in place, into packages/shell/android/build/",
  };
  for (const [entry, reason] of Object.entries(reasons)) {
    if (!lines.has(entry)) ctx.problem('.gitignore', 0, 'gitignore', `does not ignore ${entry}`, `Add the line ${entry}: ${reason}.`);
  }
}

function checkMetro(ctx) {
  for (const game of ctx.apps) {
    const rel = `apps/${game}/metro.config.js`;
    const metro = read(ctx.root, rel);
    if (metro === null) {
      ctx.problem(rel, 0, 'metro-cache-key', 'metro.config.js is missing', 'Copy the variant-keyed metro.config.js: without it a store build can reuse test-build transforms.');
      continue;
    }
    const code = maskComments(metro);
    if (/cacheVersion\s*=[^\n;]*EXPO_PUBLIC_APP_VARIANT/.test(code)) continue;
    const at = code.indexOf('cacheVersion');
    ctx.problem(rel, at < 0 ? 1 : lineOf(code, at), 'metro-cache-key', 'config.cacheVersion is not keyed on EXPO_PUBLIC_APP_VARIANT', "Set config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? 'test'}`: Metro's cache ignores EXPO_PUBLIC_* values.");
  }
}

const ADB_FREE = new Set(['devices', 'version', 'start-server']);
const ADB_FIX = "Build every adb call with adbArgs(serial, [...]) from packages/tooling/src/android/emulators.ts: several emulators and sessions share this Mac's adb server, and a call without -s reaches whichever device answers.";

/** execFileSync(<adb>, <args>) and friends: the arguments must start with -s or come from adbArgs(). */
function adbCallProblems(code) {
  const found = [];
  const call = /\b(?:execFileSync|execFile|spawnSync|spawn)\(\s*([\w.$[\]'"]*adb[\w.$[\]'"]*)\s*,\s*/gi;
  for (const match of code.matchAll(call)) {
    const rest = code.slice(match.index + match[0].length);
    if (/^adbArgs\(/.test(rest)) continue;
    const literal = /^\[\s*(['"`])([^'"`]*)\1/.exec(rest);
    if (literal && (literal[2] === '-s' || literal[2] === 'kill-server' || ADB_FREE.has(literal[2]))) continue;
    found.push({ index: match.index, message: literal ? `adb ${literal[2]} without -s <serial>` : 'an adb call whose arguments do not come from adbArgs()' });
  }
  // Shell form inside a string (`adb shell ...`): only real adb commands, so prose such as "every adb call" is not one.
  for (const match of code.matchAll(/\badb\s+(shell|install|uninstall|exec-out|pull|push|logcat|root|unroot|reboot|emu|wait-for-device|forward|reverse|kill-server)\b/g)) {
    found.push({ index: match.index, message: `"adb ${match[1]}" without -s <serial>` });
  }
  for (const match of code.matchAll(/\[\s*['"]kill-server['"]/g)) found.push({ index: match.index, message: 'adb kill-server stops every session\'s emulator connections' });
  return found;
}

function checkTooling(ctx) {
  const dir = join(ctx.root, 'packages/tooling/src');
  if (!existsSync(dir)) return;
  // Only node_modules is skipped here: packages/tooling/src/android/ and build/ are source folders.
  for (const rel of walk(dir, { include: ['*.ts', '*.mts', '*.js', '*.mjs', '*.sh'], ignore: ['node_modules'] })) {
    if (/\.test\.m?[tj]s$/.test(rel)) continue;
    const full = `packages/tooling/src/${rel}`;
    const code = maskComments(readFileSync(join(dir, rel), 'utf8'));
    for (const found of adbCallProblems(code)) ctx.problem(full, lineOf(code, found.index), 'adb-serial', found.message, ADB_FIX);
    for (const match of code.matchAll(/['"](?:--name|-n|-avd)['"]\s*,\s*['"]([^'"]+)['"]|(?:\bavd\s+(?:--name|-n)|(?<![\w-])-avd)\s+([A-Za-z][\w.-]*)/g)) {
      const name = match[1] ?? match[2];
      if (!name.startsWith('e07-android-')) ctx.problem(full, lineOf(code, match.index), 'avd-name', `names the AVD "${name}"`, "Create and start only e07-android-<purpose> AVDs through avdName(): other projects' AVDs on this Mac are never touched.");
    }
    const playstore = code.search(/google_apis_playstore/);
    if (playstore >= 0) ctx.problem(full, lineOf(code, playstore), 'play-image', 'uses a Play Store system image', "Pin system-images;android-<api>;google_apis;arm64-v8a: adb root, which the kill test and save inspection need, fails on Play Store images.");
    const bundle = code.search(/['"]bundleRelease['"]/);
    if (bundle >= 0 && !full.startsWith('packages/tooling/src/release-android/')) ctx.problem(full, lineOf(code, bundle), 'gradle-task', 'runs bundleRelease outside the Play release tooling', 'The emulator installs an APK: use assembleRelease (GRADLE_RELEASE_ARGS); the AAB is built only by npm run release:android.');
  }
  const plan = read(ctx.root, 'packages/tooling/src/build/emu-build-plan.ts');
  if (plan !== null && !/['"]assembleRelease['"]/.test(maskComments(plan))) ctx.problem('packages/tooling/src/build/emu-build-plan.ts', 1, 'gradle-task', 'GRADLE_RELEASE_ARGS does not assemble the Release APK', "Use ['assembleRelease', '--console=plain'] (templates/packages/tooling/src/build/emu-build-plan.ts).");
}

function checkJdk(ctx) {
  const rel = 'packages/tooling/src/android/toolchain.ts';
  const source = read(ctx.root, rel);
  if (source === null) return; // tooling-files reports it
  const code = maskComments(source);
  const pin = /export\s+const\s+JDK_MAJOR\s*=\s*(\d+)/.exec(code);
  if (!pin || pin[1] !== '17') ctx.problem(rel, pin ? lineOf(code, pin.index) : 0, 'jdk-pin', `JDK_MAJOR is ${pin ? pin[1] : 'not exported'}, expected 17`, 'Gradle 9 with AGP 8.12 (React Native 0.86.3) builds on JDK 17, the JBR of Android Studio; another major fails or changes the bytecode.');
  for (const name of ['JAVA_HOME', 'ANDROID_HOME', 'EXPO_NO_TELEMETRY', 'CI']) {
    if (!new RegExp(`\\b${name}:\\s`).test(code)) ctx.problem(rel, 0, 'jdk-pin', `the tool environment does not set ${name}`, 'Build every child-process env with androidToolEnv() from the template: JDK and SDK per process, no telemetry, no prompts.');
  }
}

function listApps(root) {
  const apps = join(root, 'apps');
  if (!existsSync(apps)) return [];
  return walk(apps, { include: ['*/package.json'], ignore: IGNORE }).map((rel) => rel.split('/')[0]);
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const hasRepo = existsSync(join(root, 'package.json')) || existsSync(join(root, 'apps')) || existsSync(join(root, 'packages'));
  if (!hasRepo) fail(`nothing to check: ${root} has no package.json, apps/ or packages/`, 'Run from the repo root, or pass it as the first argument.');
  const report = createReporter({ name: 'check-emu-setup', json: options.json });
  const ctx = { root, apps: listApps(root), problem: (file, line, rule, message, fix) => report.problem({ file, line, rule, message, fix }) };
  checkScriptAndFiles(ctx);
  checkGitignore(ctx);
  checkMetro(ctx);
  checkTooling(ctx);
  checkJdk(ctx);
  return report.finish({ checked: ctx.apps.length + 1, unit: 'apps and the shared Android tooling' });
});
