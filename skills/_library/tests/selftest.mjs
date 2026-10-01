#!/usr/bin/env node
// tests/selftest.mjs: the library's own self-test.
//  1. check-lib: globs, walker, REPO_SCAN_IGNORES, shell-slice.json, dueSkipReason, argument parsing, reporter output
//     (SKIP lines, NOT APPLICABLE), exit codes, comment masking, the self-test runner's four fixture kinds
//     (good, pass-*, bad-*, error-*), and the pinned-package helpers (--tooling folder, install fix).
//  2. The validator on every case in tests/cases/: good cases pass, and each planted-bad case fails
//     with exactly the rule named in its case.json (run on a synced temporary copy).
//  3. The validator's library-layout rule, the device-explicit detector, the skill template, and the
//     frontmatter parser.
//  4. sync-shared, link-skills (link and copy modes), record-sources + check-staleness (and the sources.json
//     lock: concurrent writers, a stale lock, a held lock), selftest-all.
//  5. The shared files: fonts match fonts/SOURCES.md, JSON copies parse, settings.proposed.json.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listCaseSkills, readManifest, syncShared } from '../lib/library.mjs';
import { parseYamlSubset, splitFrontmatter } from '../lib/frontmatter.mjs';
import { sanitize } from '../refresh-shared.mjs';
import { findImplicitDeviceCalls, findProjectRefs } from '../validate-skills.mjs';
import { REPO_SCAN_IGNORES, SELFTEST_CASES, SHELL_DUE_TARGETS, createReporter, dueSkipReason, globToRegExp, importPackage, isRepoScanIgnored, makeTempDir, maskComments, matchGlob, packageInstallFix, parseArgs, readShellSlice, removeTempDir, resolveToolingDir, run, selftestCaseKind, sha256, sliceSkipReason, walk } from '../shared/scripts/check-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = join(HERE, '..');
const SHARED = join(LIB, 'shared');
const CHECK_LIB = join(SHARED, 'scripts', 'check-lib.mjs');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function node(script, args = [], cwd = LIB) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
  const stdout = result.stdout ?? '';
  return { status: result.status, stdout, output: `${stdout}${result.stderr ?? ''}`, last: stdout.split('\n').filter(Boolean).at(-1) ?? '' };
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function rulesOf(result) {
  const json = result.stdout.split('\n').find((line) => line.startsWith('{"skills"'));
  assert.ok(json, `no JSON line in validator output:\n${result.output.slice(-2000)}`);
  const data = JSON.parse(json);
  return [...new Set(data.skills.flatMap((skill) => skill.problems.map((problem) => problem.rule)))].sort();
}

// ---------------------------------------------------------------------------------------------
// 1. check-lib
// ---------------------------------------------------------------------------------------------

test('check-lib: globs', () => {
  assert.ok(globToRegExp('**/node_modules/**').test('a/node_modules/b.js'));
  assert.ok(globToRegExp('**/node_modules/**').test('node_modules'));
  assert.ok(globToRegExp('src/**/*.ts').test('src/a/b/c.ts'));
  assert.ok(globToRegExp('src/**/*.ts').test('src/c.ts'));
  assert.ok(!globToRegExp('src/*.ts').test('src/a/c.ts'));
  assert.ok(globToRegExp('*.{ts,tsx}').test('x.tsx'));
  assert.ok(globToRegExp('file?.md').test('file1.md'));
  assert.ok(!globToRegExp('file?.md').test('file12.md'));
  assert.ok(globToRegExp('[ab].md').test('a.md'));
  assert.ok(matchGlob('deep/down/x.png', '*.png'));
  assert.ok(matchGlob('a/node_modules/x/y.js', 'node_modules'));
  assert.ok(matchGlob('docs/a/b.md', 'docs/'));
  assert.ok(!matchGlob('src/docs.md', 'docs/'));
});

test('check-lib: walk with ignores, includes and symlinks', () => {
  const dir = makeTempDir('selftest-walk-');
  try {
    write(join(dir, 'a.ts'), '');
    write(join(dir, 'b.md'), '');
    write(join(dir, 'sub', 'c.ts'), '');
    write(join(dir, 'node_modules', 'x.ts'), '');
    write(join(dir, 'fix', 'EXPECT.txt'), 'x');
    write(join(dir, 'gen', 'd.ts'), '');
    symlinkSync(join(dir, 'a.ts'), join(dir, 'link.ts'));
    const links = [];
    assert.deepEqual(walk(dir, { include: ['*.ts'], ignore: ['gen/**'], onSymlink: (rel) => links.push(rel) }), ['a.ts', 'sub/c.ts']);
    assert.deepEqual(links, ['link.ts']);
    assert.deepEqual(walk(dir, { followSymlinks: true, include: ['*.ts'] }), ['a.ts', 'gen/d.ts', 'link.ts', 'sub/c.ts']);
    assert.ok(walk(dir, { defaultIgnores: false }).includes('fix/EXPECT.txt'));
    assert.ok(!walk(dir).includes('fix/EXPECT.txt'));
  } finally {
    removeTempDir(dir);
  }
});

test('check-lib: REPO_SCAN_IGNORES skip the skill library and generated output, not same-named source folders', () => {
  const dir = makeTempDir('selftest-repo-scan-');
  try {
    const kept = ['apps/line-siege/src/rules/a.ts', 'packages/tooling/src/build/build-ios-sim.ts', 'packages/tooling/src/ios/plist.ts', 'reports/ios/r.json', 'test/sims/a.sim.test.ts'];
    const skipped = ['skills/golden-tests/tests/fixtures/good/a.golden.test.ts.snap', '.claude/skills/x/SKILL.md', 'apps/line-siege/ios/Pods/Headers/a.h', 'apps/line-siege/build/out.js', 'apps/line-siege/out/x.js', 'apps/line-siege/android/a.java', 'apps/line-siege/.expo/state.json', 'packages/shell/node_modules/x/index.js', 'build/x.js', 'out/y.js', 'ios/Podfile'];
    for (const rel of [...kept, ...skipped]) write(join(dir, rel), 'x');
    assert.deepEqual(walk(dir, { ignore: [...REPO_SCAN_IGNORES] }), [...kept].sort());
    for (const rel of skipped) assert.ok(isRepoScanIgnored(rel), `${rel} should be ignored`);
    for (const rel of kept) assert.ok(!isRepoScanIgnored(rel), `${rel} should be scanned`);
    assert.ok(isRepoScanIgnored('./skills/a/b.ts'));
    assert.ok(Object.isFrozen(REPO_SCAN_IGNORES));
    // From one app folder the same patterns skip its generated folders.
    assert.deepEqual(walk(join(dir, 'apps', 'line-siege'), { ignore: [...REPO_SCAN_IGNORES] }), ['src/rules/a.ts']);
  } finally {
    removeTempDir(dir);
  }
});

test('check-lib: readShellSlice and sliceSkipReason', () => {
  const dir = makeTempDir('selftest-slice-');
  try {
    assert.equal(readShellSlice(dir), null);
    assert.equal(sliceSkipReason(null, 'S5'), null);
    assert.equal(sliceSkipReason(null), null);
    write(join(dir, 'shell-slice.json'), JSON.stringify({ screens: ['S4', 'S11', 'S11a', 'S12'], why: ' Home + Settings parity slice ' }));
    const slice = readShellSlice(dir);
    assert.deepEqual([...slice.screens], ['S4', 'S11', 'S11a', 'S12']);
    assert.equal(slice.why, 'Home + Settings parity slice');
    assert.equal(slice.hasShellApp, true);
    assert.equal(sliceSkipReason(slice, 'S4'), null);
    assert.equal(sliceSkipReason(slice, 'S5'), 'S5 not in shell-slice.json');
    assert.equal(sliceSkipReason(slice, 'S11b'), 'S11b not in shell-slice.json');
    assert.equal(sliceSkipReason(slice), null);
    assert.throws(() => sliceSkipReason(slice, 'S16'), /unknown screen id/);
    write(join(dir, 'shell-slice.json'), JSON.stringify({ screens: [], why: 'game-first repo' }));
    const gameFirst = readShellSlice(dir);
    assert.equal(gameFirst.hasShellApp, false);
    assert.equal(sliceSkipReason(gameFirst), 'no Shell app (shell-slice.json has "screens": [])');
    for (const [content, pattern] of [
      ['{', /not valid JSON/],
      ['[]', /one object/],
      [JSON.stringify({ screens: ['S4'], why: 'x', extra: 1 }), /unknown keys: extra/],
      [JSON.stringify({ why: 'x' }), /needs "screens"/],
      [JSON.stringify({ screens: ['S4', 'S16', 'Home'], why: 'x' }), /unknown screens: S16, Home/],
      [JSON.stringify({ screens: ['S4', 'S4'], why: 'x' }), /twice/],
      [JSON.stringify({ screens: ['S4'], why: '  ' }), /needs "why"/],
    ]) {
      write(join(dir, 'shell-slice.json'), content);
      assert.throws(() => readShellSlice(dir), (error) => error.name === 'UsageError' && pattern.test(error.message) && /S11a-S11d/.test(error.fix), content);
    }
  } finally {
    removeTempDir(dir);
  }
});

test('check-lib: dueSkipReason and SHELL_DUE_TARGETS', () => {
  const dir = makeTempDir('selftest-due-');
  try {
    assert.ok(Object.isFrozen(SHELL_DUE_TARGETS) && Object.values(SHELL_DUE_TARGETS).every(Object.isFrozen));
    assert.deepEqual(SHELL_DUE_TARGETS.plugins, { file: 'packages/shell/src/config/shell-plugins.ts', step: 8 });
    assert.deepEqual(SHELL_DUE_TARGETS.catalogs, { file: 'packages/shell/src/i18n/catalogs/en.json', step: 6 });
    // start-shell.ts lands at Shell step 7 with the composition root (it imports createShellApp and the
    // startup splash), together with the two save boot files, the splash and the JS half of app/perf/.
    assert.deepEqual(SHELL_DUE_TARGETS.boot, { file: 'packages/shell/src/app/start-shell.ts', step: 7 });
    // The script targets of check-gate-wiring's script-target rule: the E2E runner (step 10) and the
    // release pipeline (step 11), so e2e:ios and release:ios SKIP until their step and are strict after it.
    assert.deepEqual(SHELL_DUE_TARGETS.e2e, { file: 'packages/tooling/src/e2e/run-e2e-ios.ts', step: 10 });
    assert.deepEqual(SHELL_DUE_TARGETS.release, { file: 'packages/tooling/src/release/release-ios.ts', step: 11 });
    assert.deepEqual(Object.keys(SHELL_DUE_TARGETS).sort(), ['boot', 'catalogs', 'e2e', 'plugins', 'release']);
    assert.equal(dueSkipReason(dir, SHELL_DUE_TARGETS.e2e), 'due at Shell step 10: packages/tooling/src/e2e/run-e2e-ios.ts not yet created');
    assert.equal(dueSkipReason(dir, SHELL_DUE_TARGETS.release), 'due at Shell step 11: packages/tooling/src/release/release-ios.ts not yet created');
    // Missing: the rule is not yet due, with the step and the file in the reason.
    assert.equal(dueSkipReason(dir, SHELL_DUE_TARGETS.plugins), 'due at Shell step 8: packages/shell/src/config/shell-plugins.ts not yet created');
    assert.equal(dueSkipReason(dir, { file: './packages/shell/src/app/start-shell.ts', step: 6 }), 'due at Shell step 6: packages/shell/src/app/start-shell.ts not yet created');
    assert.equal(dueSkipReason(dir, SHELL_DUE_TARGETS.boot), 'due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created');
    // Present: the rule is strict from now on.
    write(join(dir, 'packages', 'shell', 'src', 'config', 'shell-plugins.ts'), 'export const SHELL_PLUGINS = [];\n');
    assert.equal(dueSkipReason(dir, SHELL_DUE_TARGETS.plugins), null);
    assert.equal(dueSkipReason(dir, SHELL_DUE_TARGETS.catalogs), 'due at Shell step 6: packages/shell/src/i18n/catalogs/en.json not yet created');
    // A folder at the path counts as created (a mirrored folder target).
    mkdirSync(join(dir, 'packages', 'shell', 'src', 'app', 'perf'), { recursive: true });
    assert.equal(dueSkipReason(dir, { file: 'packages/shell/src/app/perf', step: 8 }), null);
    // Programmer errors throw (a crash exits 2), never a silent pass.
    for (const bad of [undefined, {}, { file: '', step: 6 }, { file: '/abs/x.ts', step: 6 }, { file: '../x.ts', step: 6 }, { file: 'a.ts' }, { file: 'a.ts', step: 0 }, { file: 'a.ts', step: 6.5 }, { file: 'a.ts', step: '6' }]) {
      assert.throws(() => dueSkipReason(dir, bad), /dueSkipReason: target\.(file|step)/, JSON.stringify(bad));
    }
  } finally {
    removeTempDir(dir);
  }
});

test('check-lib: a not-yet-due rule prints SKIP and passes, then fails once its file exists', () => {
  const dir = makeTempDir('selftest-due-probe-');
  try {
    cpSync(CHECK_LIB, join(dir, 'check-lib.mjs'));
    const script = join(dir, 'probe.mjs');
    write(script, `import { SHELL_DUE_TARGETS, createReporter, dueSkipReason, parseArgs, requireDir, run } from './check-lib.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const SPEC = { name: 'probe-due', summary: 'Probe script.', usage: '[repo-root]', options: {}, positionals: { min: 0, max: 1 } };
run(async () => {
  const { positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const report = createReporter({ name: 'probe-due' });
  const file = SHELL_DUE_TARGETS.plugins.file;
  const reason = dueSkipReason(root, SHELL_DUE_TARGETS.plugins);
  if (reason) report.skip({ file, rule: 'plugin-entry', message: reason });
  else if (!readFileSync(join(root, file), 'utf8').includes('expo-font')) report.problem({ file, line: 1, rule: 'plugin-entry', message: 'no expo-font plugin entry', fix: 'Add it.' });
  return report.finish({ checked: existsSync(join(root, 'package.json')) ? 1 : 0, unit: 'files' });
});
`);
    write(join(dir, 'package.json'), '{}');
    const early = node(script, ['.'], dir);
    assert.equal(early.status, 0, early.output);
    assert.match(early.stdout, /^SKIP packages\/shell\/src\/config\/shell-plugins\.ts \[plugin-entry\] due at Shell step 8: packages\/shell\/src\/config\/shell-plugins\.ts not yet created$/m);
    assert.match(early.stdout, /probe-due: 1 files checked, 0 problems, 1 skipped/);
    assert.equal(early.last, 'RESULT: PASS');
    write(join(dir, 'packages', 'shell', 'src', 'config', 'shell-plugins.ts'), 'export const SHELL_PLUGINS = [];\n');
    const due = node(script, ['.'], dir);
    assert.equal(due.status, 1, due.output);
    assert.doesNotMatch(due.stdout, /^SKIP/m);
    assert.match(due.stdout, /^FAIL packages\/shell\/src\/config\/shell-plugins\.ts:1 \[plugin-entry\] no expo-font plugin entry/m);
  } finally {
    removeTempDir(dir);
  }
});

test('check-lib: SKIP lines and NOT APPLICABLE pass, the --root guess names the positional root', () => {
  const dir = makeTempDir('selftest-skip-');
  try {
    const script = join(dir, 'probe.mjs');
    cpSync(CHECK_LIB, join(dir, 'check-lib.mjs'));
    write(script, `import { createReporter, parseArgs, readShellSlice, requireDir, run, sliceSkipReason } from './check-lib.mjs';
const SPEC = { name: 'probe', summary: 'Probe script.', usage: '[options] [repo-root]', options: { mode: { type: 'string', default: 'skip' }, json: { type: 'boolean' } }, positionals: { min: 0, max: 1 } };
run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const report = createReporter({ name: 'probe', json: options.json });
  const slice = readShellSlice(root);
  const reason = sliceSkipReason(slice, 'S5');
  if (reason) report.skip({ file: 'packages/shell/src/screens/game/game-screen.tsx', rule: 'game-route', message: reason });
  if (options.mode === 'na') return report.notApplicable('every game module has realtime: null');
  if (options.mode === 'fail') report.problem({ file: 'a.ts', line: 2, rule: 'rule-a', message: 'bad', fix: 'Fix a.' });
  if (options.mode === 'late-na') { report.problem({ rule: 'x', message: 'y' }); return report.notApplicable('z'); }
  return report.finish({ checked: options.mode === 'only-skips' ? 0 : 3, unit: 'files' });
});
`);
    write(join(dir, 'shell-slice.json'), JSON.stringify({ screens: ['S4', 'S11'], why: 'Home + Settings slice' }));
    const skipped = node(script, ['.', '--json'], dir);
    assert.equal(skipped.status, 0, skipped.output);
    assert.equal(skipped.last, 'RESULT: PASS');
    assert.match(skipped.stdout, /^SKIP packages\/shell\/src\/screens\/game\/game-screen\.tsx \[game-route\] S5 not in shell-slice\.json$/m);
    assert.match(skipped.stdout, /probe: 3 files checked, 0 problems, 1 skipped/);
    assert.match(skipped.stdout, /"skips":\[\{"file":"packages\/shell\/src\/screens\/game\/game-screen\.tsx","rule":"game-route","message":"S5 not in shell-slice\.json"\}\]/);
    const onlySkips = node(script, ['.', '--mode', 'only-skips'], dir);
    assert.equal(onlySkips.status, 0, onlySkips.output);
    const failing = node(script, ['.', '--mode', 'fail'], dir);
    assert.equal(failing.status, 1);
    assert.equal(failing.last, 'RESULT: FAIL (1 problems)');
    assert.match(failing.stdout, /probe: 3 files checked, 1 problems, 1 skipped/);
    const na = node(script, ['.', '--mode', 'na'], dir);
    assert.equal(na.status, 0, na.output);
    assert.match(na.stdout, /^NOT APPLICABLE: every game module has realtime: null$/m);
    assert.equal(na.last, 'RESULT: PASS');
    const lateNa = node(script, ['.', '--mode', 'late-na'], dir);
    assert.equal(lateNa.status, 2);
    assert.match(lateNa.stdout, /notApplicable\(\) after problems/);
    rmSync(join(dir, 'shell-slice.json'));
    const full = node(script, ['.'], dir);
    assert.equal(full.status, 0);
    assert.doesNotMatch(full.stdout, /SKIP|skipped/);
    assert.equal(node(script, ['.', '--mode', 'only-skips'], dir).status, 2, 'nothing checked and nothing skipped is still exit 2');
    write(join(dir, 'shell-slice.json'), '{"screens":["S99"],"why":"x"}');
    const broken = node(script, ['.'], dir);
    assert.equal(broken.status, 2);
    assert.match(broken.stdout, /ERROR \[bad-input\] shell-slice\.json names unknown screens: S99/);
    const guessed = node(script, ['--root', '.'], dir);
    assert.equal(guessed.status, 2);
    assert.match(guessed.stdout, /Unknown option '--root'.*takes the repo root as a positional argument, not --root: node probe\.mjs <repo-root>/);
  } finally {
    removeTempDir(dir);
  }
});

test('check-lib: a script with a --root option also takes the repo root positionally', () => {
  const dir = makeTempDir('selftest-root-');
  try {
    cpSync(CHECK_LIB, join(dir, 'check-lib.mjs'));
    const probe = (name, multiple) => {
      const script = join(dir, `${name}.mjs`);
      write(script, `import { createReporter, parseArgs, run } from './check-lib.mjs';
const SPEC = { name: '${name}', summary: 'Probe.', usage: '[--root <dir>]', options: { root: { type: 'string', default: ${multiple ? "undefined, multiple: true" : "'.'"}, help: 'App repo root' } } };
run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const report = createReporter({ name: '${name}' });
  report.note('root=' + JSON.stringify(options.root));
  return report.finish({ checked: 1 });
});
`);
      return script;
    };
    const single = probe('single', false);
    const repeat = probe('repeat', true);
    assert.match(node(single, ['sub'], dir).stdout, /^root="sub"$/m, 'a positional root fills --root');
    assert.match(node(single, ['--root', 'sub'], dir).stdout, /^root="sub"$/m, '--root still works');
    assert.match(node(single, [], dir).stdout, /^root="\."$/m, 'the default stays');
    assert.match(node(repeat, ['sub'], dir).stdout, /^root=\["sub"\]$/m, 'a repeatable --root gets a one-item list');
    const twice = node(single, ['--root', 'a', 'b'], dir);
    assert.equal(twice.status, 2);
    assert.match(twice.stdout, /the repo root was given twice: --root a and b/);
    const extra = node(single, ['a', 'b'], dir);
    assert.equal(extra.status, 2);
    assert.match(extra.stdout, /expected at most 0 argument\(s\), got 2/);
    assert.match(node(single, ['--help'], dir).stdout, /--root <value>\s+App repo root \(default: \.\); may also be given as the first argument/);
  } finally {
    removeTempDir(dir);
  }
});

test('check-lib: maskComments keeps strings, regexes and line numbers', () => {
  const source = "const a = 'x // not a comment'; // comment\n/* block\n export default */ const r = /\\/\\/ab/g;\nconst t = `a /* b */`;\nreturn /x/.test(y);";
  const masked = maskComments(source);
  assert.equal(masked.split('\n').length, source.split('\n').length);
  assert.ok(masked.includes("'x // not a comment'"));
  assert.ok(!masked.includes('comment\n'));
  assert.ok(!masked.includes('export default'));
  assert.ok(masked.includes('/\\/\\/ab/g'));
  assert.ok(masked.includes('`a /* b */`'));
  assert.ok(masked.includes('/x/.test'));
});

test('check-lib: parseArgs, reporter, run and exit codes', () => {
  const dir = makeTempDir('selftest-cli-');
  try {
    const script = join(dir, 'probe.mjs');
    cpSync(CHECK_LIB, join(dir, 'check-lib.mjs'));
    write(script, `import { createReporter, parseArgs, run, fail } from './check-lib.mjs';
const SPEC = { name: 'probe', summary: 'Probe script.', usage: '[options] [mode]', options: { root: { type: 'string', default: '.', help: 'Root' }, json: { type: 'boolean', help: 'JSON' } }, positionals: { min: 0, max: 1 } };
run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const mode = positionals[0] ?? 'pass';
  if (mode === 'crash') throw new Error('boom');
  if (mode === 'bad') fail('the target is missing', 'Pass a real target.');
  const report = createReporter({ name: 'probe', json: options.json });
  if (mode === 'problems') {
    report.problem({ file: 'b.ts', line: 3, rule: 'rule-b', message: 'second', fix: 'Fix b.' });
    report.problem({ file: 'a.ts', line: 7, rule: 'rule-a', message: 'first', fix: 'Fix a.' });
  }
  return report.finish({ checked: mode === 'empty' ? 0 : 2, unit: 'files' });
});
`);
    const help = node(script, ['--help'], dir);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /^Usage: node probe\.mjs \[options\] \[mode\]/);
    assert.match(help.stdout, /--root <value>\s+Root \(default: \.\)/);
    const pass = node(script, [], dir);
    assert.equal(pass.status, 0);
    assert.equal(pass.last, 'RESULT: PASS');
    assert.match(pass.stdout, /probe: 2 files checked, 0 problems/);
    const problems = node(script, ['problems', '--json'], dir);
    assert.equal(problems.status, 1);
    assert.equal(problems.last, 'RESULT: FAIL (2 problems)');
    const lines = problems.stdout.split('\n');
    assert.equal(lines[0], 'FAIL a.ts:7 [rule-a] first Fix: Fix a.');
    assert.equal(lines[1], 'FAIL b.ts:3 [rule-b] second Fix: Fix b.');
    assert.ok(lines.some((line) => line.startsWith('{"name":"probe"')));
    for (const [args, pattern] of [[['bad'], /ERROR \[bad-input\] the target is missing Fix: Pass a real target\./], [['--nope'], /ERROR \[bad-input\] Unknown option '--nope'/], [['a', 'b'], /at most 1 argument/], [['crash'], /ERROR \[crash\] Error: boom/], [['empty'], /nothing to check: 0 files found/]]) {
      const result = node(script, args, dir);
      assert.equal(result.status, 2, `${args.join(' ')} should exit 2`);
      assert.match(result.stdout, pattern);
      assert.equal(result.last, 'RESULT: FAIL (1 problems)');
    }
  } finally {
    removeTempDir(dir);
  }
});

test('check-lib: runSelftest catches a checker that misses its planted bug', () => {
  const dir = makeTempDir('selftest-runner-');
  try {
    cpSync(join(LIB, 'skill-template'), join(dir, 'skill'), { recursive: true });
    const skill = join(dir, 'skill');
    cpSync(CHECK_LIB, join(skill, 'scripts', 'check-lib.mjs'));
    const ok = node(join(skill, 'scripts', 'selftest.mjs'), [], dir);
    assert.equal(ok.status, 0, ok.output);
    // Break the checker: it no longer reports default exports.
    const checker = join(skill, 'scripts', 'check-exports.mjs');
    writeFileSync(checker, readFileSync(checker, 'utf8').replace('/\\bexport\\s+default\\b/g', '/\\bnever-matches\\b/g'));
    const broken = node(join(skill, 'scripts', 'selftest.mjs'), [], dir);
    assert.equal(broken.status, 1);
    assert.match(broken.stdout, /\[selftest-case\] check-exports\.mjs bad-default-export: expected exit 1, got 0/);
    assert.equal(broken.last, 'RESULT: FAIL (1 problems)');
    // A fixture without EXPECT.txt is itself a failure.
    rmSync(join(skill, 'tests', 'fixtures', 'bad-file-name', 'EXPECT.txt'));
    assert.match(node(join(skill, 'scripts', 'selftest.mjs'), [], dir).stdout, /\[selftest-expect\]/);
    // A checker that cannot run at all (every fixture exits 2 the same way) makes the self-test exit 2 once.
    writeFileSync(checker, readFileSync(checker, 'utf8').replace("const folders = ", "fail('the image package is not installed', 'Run npm ci --prefix scripts.');\n  const folders = ").replace(" } from './check-lib.mjs';", ", fail } from './check-lib.mjs';"));
    const env = node(join(skill, 'scripts', 'selftest.mjs'), [], dir);
    assert.equal(env.status, 2, env.output);
    assert.match(env.stdout, /ERROR \[bad-input\] check-exports\.mjs cannot run here, every fixture stopped with: the image package is not installed Fix: Run npm ci --prefix scripts\./);
  } finally {
    removeTempDir(dir);
  }
});

test('check-lib: runSelftest runs pass-* (exit 0) and error-* (exit 2) cases with their EXPECT.txt lines', () => {
  assert.equal(selftestCaseKind('good'), 'good');
  assert.equal(selftestCaseKind('pass-skip-line'), 'pass-');
  assert.equal(selftestCaseKind('bad-x'), 'bad-');
  assert.equal(selftestCaseKind('error-no-root'), 'error-');
  for (const name of ['base', 'pass-', 'bad-', 'error-', 'passing', 'good-2', 'errors']) assert.equal(selftestCaseKind(name), null, name);
  assert.deepEqual(Object.fromEntries(Object.entries(SELFTEST_CASES).map(([kind, value]) => [kind, value.exit])), { good: 0, 'pass-': 0, 'bad-': 1, 'error-': 2 });
  const dir = makeTempDir('selftest-kinds-');
  try {
    cpSync(join(LIB, 'skill-template'), join(dir, 'skill'), { recursive: true });
    const skill = join(dir, 'skill');
    cpSync(CHECK_LIB, join(skill, 'scripts', 'check-lib.mjs'));
    const selftest = join(skill, 'scripts', 'selftest.mjs');
    const fixtures = join(skill, 'tests', 'fixtures');
    const ok = node(selftest, [], dir);
    assert.equal(ok.status, 0, ok.output);
    assert.match(ok.stdout, /^ok {3}check-exports\.mjs pass-declaration-files \(exit 0, found "check-exports: 1 TypeScript files checked, 0 problems"\)$/m);
    // The error case ran with the words of its ARGS.txt, not with args(dir).
    assert.match(ok.stdout, /^ok {3}check-exports\.mjs error-missing-folder \(exit 2, found "ERROR \[bad-input\] nothing to check: folder no-such-folder/m);
    // A checker that misses a line a passing case must print fails the self-test.
    const checker = join(skill, 'scripts', 'check-exports.mjs');
    const original = readFileSync(checker, 'utf8');
    writeFileSync(checker, original.replace("createReporter({ name: 'check-exports', json: options.json })", "createReporter({ name: 'check-modules', json: options.json })"));
    const missed = node(selftest, [], dir);
    assert.equal(missed.status, 1, missed.output);
    assert.match(missed.stdout, /\[selftest-case\] check-exports\.mjs pass-declaration-files: output does not contain "check-exports: 1 TypeScript files checked, 0 problems"/);
    assert.match(missed.stdout, /Fix: Fix the checker so this passing case exits 0 and prints what EXPECT\.txt says\./);
    // A passing case whose checker finds a problem (exit 1) fails too.
    writeFileSync(checker, original);
    write(join(fixtures, 'pass-declaration-files', 'src', 'extra.ts'), 'export default 1;\n');
    const exit1 = node(selftest, [], dir);
    assert.match(exit1.stdout, /\[selftest-case\] check-exports\.mjs pass-declaration-files: expected exit 0, got 1/);
    rmSync(join(fixtures, 'pass-declaration-files', 'src', 'extra.ts'));
    // A checker that reports bad input as a problem (exit 1) instead of stopping (exit 2) fails the error case.
    writeFileSync(checker, original.replace(".map((folder) => requireDir(folder, 'folder'));", ".filter((folder) => existsSync(folder) || (earlyProblems.push(folder), false)).map((folder) => requireDir(folder, 'folder'));").replace("import { join, relative, resolve } from 'node:path';", "import { join, relative, resolve } from 'node:path';\nimport { existsSync } from 'node:fs';\nconst earlyProblems = [];").replace("  let checked = 0;\n", "  let checked = 0;\n  for (const folder of earlyProblems) report.problem({ file: folder, rule: 'missing-folder', message: `nothing to check: folder ${folder} does not exist or is not a folder` });\n"));
    const wrongExit = node(selftest, [], dir);
    assert.equal(wrongExit.status, 1, wrongExit.output);
    assert.match(wrongExit.stdout, /\[selftest-case\] check-exports\.mjs error-missing-folder: expected exit 2, got 1/);
    assert.match(wrongExit.stdout, /exit 1 is for problems found, exit 2 for bad input\./);
    writeFileSync(checker, original);
    // Every case kind except good needs a non-empty EXPECT.txt.
    writeFileSync(join(fixtures, 'error-missing-folder', 'EXPECT.txt'), '\n');
    assert.match(node(selftest, [], dir).stdout, /\[selftest-expect\] error-missing-folder has no EXPECT\.txt \(or it is empty\)/);
    writeFileSync(join(fixtures, 'error-missing-folder', 'EXPECT.txt'), 'ERROR [bad-input] nothing to check\n');
    rmSync(join(fixtures, 'pass-declaration-files', 'EXPECT.txt'));
    assert.match(node(selftest, [], dir).stdout, /\[selftest-expect\] pass-declaration-files has no EXPECT\.txt/);
    // An error case stops with exit 2 on purpose, so it never makes the runner think the environment is broken.
    writeFileSync(join(fixtures, 'pass-declaration-files', 'EXPECT.txt'), 'check-exports: 1 TypeScript files checked, 0 problems\n');
    const again = node(selftest, [], dir);
    assert.equal(again.status, 0, again.output);
    // The validator asks for the same EXPECT.txt in every pass-* and error-* case.
    writeFileSync(join(fixtures, 'error-missing-folder', 'EXPECT.txt'), '');
    const validated = node(join(LIB, 'validate-skills.mjs'), ['--json', '--no-run', skill], dir);
    assert.ok(rulesOf(validated).includes('fixtures'), validated.output);
    assert.match(validated.stdout, /tests\/fixtures\/error-missing-folder\/EXPECT\.txt/);
  } finally {
    removeTempDir(dir);
  }
});

test('check-lib: pinned packages load from a --tooling folder, and the install fix names both places', async () => {
  const dir = makeTempDir('selftest-tooling-');
  const envVar = 'SELFTEST_TOOLING_DIR';
  try {
    const scriptsDir = join(dir, 'skill', 'scripts');
    mkdirSync(scriptsDir, { recursive: true });
    // resolveToolingDir: the option wins, then the variable, then the skill's scripts/ folder.
    delete process.env[envVar];
    assert.equal(resolveToolingDir({ scriptsDir, envVar }), scriptsDir);
    process.env[envVar] = join(dir, 'from-env');
    assert.equal(resolveToolingDir({ scriptsDir, envVar }), join(dir, 'from-env'));
    assert.equal(resolveToolingDir({ given: join(dir, 'repo', '.parity', 'tooling'), scriptsDir, envVar }), join(dir, 'repo', '.parity', 'tooling'));
    assert.throws(() => resolveToolingDir({}), /needs scriptsDir/);
    // packageInstallFix: the skill-folder install and the repo install with --tooling and the variable.
    const fix = packageInstallFix({ scriptsDir, envVar, repoDir: '.parity/tooling' });
    assert.ok(fix.includes(`npm ci --prefix "${scriptsDir}"`), fix);
    assert.ok(fix.includes('npm ci --prefix <repo>/.parity/tooling'), fix);
    assert.ok(fix.includes(`pass --tooling <repo>/.parity/tooling (or set ${envVar}=<repo>/.parity/tooling)`), fix);
    assert.ok(!packageInstallFix({ scriptsDir }).includes('(or set'), 'no variable named when none is given');
    // importPackage: ESM exports (import condition), a CommonJS main, and a missing package (exit 2 text).
    const tooling = join(dir, 'repo', '.parity', 'tooling');
    write(join(tooling, 'node_modules', 'esm-pkg', 'package.json'), JSON.stringify({ name: 'esm-pkg', version: '1.0.0', type: 'module', exports: { '.': { types: './index.d.ts', import: './index.mjs', require: './index.cjs' } } }));
    write(join(tooling, 'node_modules', 'esm-pkg', 'index.mjs'), 'export const kind = "esm";\n');
    write(join(tooling, 'node_modules', '@scope', 'cjs-pkg', 'package.json'), JSON.stringify({ name: '@scope/cjs-pkg', version: '1.0.0', main: './lib/main.js' }));
    write(join(tooling, 'node_modules', '@scope', 'cjs-pkg', 'lib', 'main.js'), 'exports.kind = "cjs";\n');
    assert.equal((await importPackage('esm-pkg', tooling)).kind, 'esm');
    assert.equal((await importPackage('@scope/cjs-pkg', tooling)).default.kind, 'cjs');
    await assert.rejects(() => importPackage('pngjs', tooling, { what: 'pngjs 7.0.0', fix }), (error) => error.name === 'UsageError' && /pngjs 7\.0\.0 is not installed in .*\/\.parity\/tooling\/node_modules/.test(error.message) && error.fix === fix);
  } finally {
    delete process.env[envVar];
    removeTempDir(dir);
  }
});

test('validator: device-explicit finds maestro, simctl and xcodebuild calls that do not name their simulator', () => {
  const md = (text) => findImplicitDeviceCalls(text, { kind: 'md' }).map((hit) => `${hit.line} ${hit.what}`);
  const script = (text) => findImplicitDeviceCalls(text, { kind: 'script' }).map((hit) => `${hit.line} ${hit.what}`);
  // Flagged in markdown: command lines in fences (with continuations) and in inline code.
  assert.deepEqual(md('```sh\nmaestro test flows/a.yaml\n```'), ['2 "maestro test" without --device <udid> before the command']);
  assert.deepEqual(md('```sh\ntools/maestro/bin/maestro test packages/shell/e2e/flows/a11y --udid "$UDID" \\\n  --include-tags a11y\n```'), ['2 "maestro test" without --device <udid> before the command']);
  assert.deepEqual(md('Rerun it alone: `tools/maestro/bin/maestro test <flow> --udid <udid> -e APP_ID=<id>`.'), ['1 "maestro test" without --device <udid> before the command']);
  assert.deepEqual(md('Dump it: `maestro --driver-host-port 7001 hierarchy --no-reinstall-driver`'), ['1 "maestro hierarchy" without --device <udid> before the command']);
  assert.deepEqual(md('Run `xcrun simctl io booted screenshot a.png`.'), ['1 "simctl io booted" targets whichever simulator is booted']);
  assert.deepEqual(md('If it hangs, run `xcrun simctl shutdown all`, then the setup again.'), ['1 "simctl shutdown all" targets every simulator on the Mac']);
  // A negation in an earlier clause does not excuse a command that is then run.
  assert.deepEqual(md('If the flow does not pass, rerun it: `maestro test flows/a.yaml`'), ['1 "maestro test" without --device <udid> before the command']);
  assert.deepEqual(md("```sh\nxcodebuild build -workspace A.xcworkspace \\\n  -destination 'platform=iOS Simulator,name=iPhone 17 Pro'\n```"), ['2 xcodebuild -destination "platform=iOS Simulator,name=iPhone 17 Pro" does not name the simulator by id=']);
  // Not flagged: named devices, mentions, prohibitions, anti-patterns, archives and non-device commands.
  for (const text of [
    '```sh\nmaestro --device "$UDID" --driver-host-port "$PORT" test flows/a.yaml\n```',
    '`maestro --device <udid> hierarchy --no-reinstall-driver`',
    'The runner calls `maestro test` once per flow; `maestro hierarchy` lists on-screen elements.',
    'No uploads: `maestro test --analyze`, `maestro cloud`, `maestro record` without `--local`.',
    'Never `xcrun simctl shutdown all`: other sessions use other simulators.',
    '## Anti-patterns\n\n- **`xcrun simctl erase all` to start fresh.** Reset only your own simulator.',
    '`xcrun simctl boot "$UDID"` then `xcrun simctl bootstatus $UDID -b`; `xcrun simctl list devices booted -j`; `xcrun simctl delete unavailable`',
    "```sh\nxcodebuild -workspace A.xcworkspace -destination id=$UDID build\nxcodebuild archive -destination 'generic/platform=iOS' -archivePath build/A.xcarchive\n```",
    '| `-sdk iphonesimulator`, `-destination id=<udid>` | builds for the simulator the run will use |',
    'npm pack expo --pack-destination /tmp/x',
    '### Element bounds with maestro hierarchy',
  ]) assert.deepEqual(md(text), [], text);
  // Scripts: call forms and command strings.
  assert.deepEqual(script("const r = maestro('hierarchy', '--no-reinstall-driver');"), ['1 a maestro "hierarchy" call without "--device", <udid> before the command']);
  assert.deepEqual(script("spawnSync('maestro', ['test', flow, '-e', env]);"), ['1 a maestro "test" call without "--device", <udid> before the command']);
  assert.deepEqual(script("simctl('io', 'booted', 'screenshot', path);"), ['1 a simctl "io" call on "booted"']);
  assert.deepEqual(script("fail('wedged', 'Quit Simulator.app and run: xcrun simctl shutdown all');"), ['1 "simctl shutdown all" targets every simulator on the Mac']);
  assert.deepEqual(script("exec('xcodebuild', ['-workspace', ws, '-destination', 'platform=iOS Simulator,OS=latest']);"), ['1 xcodebuild -destination "platform=iOS Simulator,OS=latest" does not name the simulator by id=']);
  for (const text of [
    "let r = maestro('--device', udid, 'hierarchy', '--no-reinstall-driver');",
    "spawnSync(tool, [...maestroGlobalArgs({ udid, driverPort }), 'test', flow]);",
    "step(`maestro hierarchy, attempt ${attempt} (about 11 s)`);",
    "'no-hierarchy': { type: 'boolean', help: 'Skip maestro hierarchy (then write app.layout.json yourself)' },",
    "simctl('ui', udid, 'appearance', theme); simctl('launch', '--terminate-running-process', udid, bundleId);",
    "exec('xcodebuild', ['-destination', `id=${udid}`, '-derivedDataPath', dd]); exec('xcodebuild', ['-destination', destination]);",
    "// never simctl openurl booted: the prompt is never accepted",
    "const maestro = makeMaestro(options.maestro, { udid, driverPort });\nlet r = maestro('hierarchy', '--no-reinstall-driver');",
  ]) assert.deepEqual(script(text), [], text);
  // A runner built without the device does not name it.
  assert.deepEqual(script("const maestro = makeMaestro(options.maestro);\nlet r = maestro('hierarchy');"), ['2 a maestro "hierarchy" call without "--device", <udid> before the command']);
});

// ---------------------------------------------------------------------------------------------
// 2-3. Validator
// ---------------------------------------------------------------------------------------------

test('frontmatter: YAML subset parser', () => {
  const lines = (text) => text.split('\n').map((line, i) => ({ text: line, line: i + 2 }));
  const good = parseYamlSubset(lines('name: a-b\ndescription: "Builds: things # really"\narguments: [game, "screen"]\nmetadata:\n  version: "1.0"\n  owner: pa\n# comment'));
  assert.deepEqual(good.errors, []);
  assert.deepEqual(good.data, { name: 'a-b', description: 'Builds: things # really', arguments: ['game', 'screen'], metadata: { version: '1.0', owner: 'pa' } });
  const bad = parseYamlSubset(lines("description: Builds x. Use when: y\nlicense: |\n  MIT\nname: 'open\nname: again\n\tkey: tab\ncompatibility: a #b"));
  const messages = bad.errors.map((error) => error.message).join('\n');
  assert.match(messages, /colon followed by a space/);
  assert.match(messages, /block scalars/);
  assert.match(messages, /not closed/);
  assert.match(messages, /duplicate key "name"/);
  assert.match(messages, /tab indentation/);
  assert.match(messages, /starts a YAML comment/);
  assert.equal(splitFrontmatter('\n---\nname: x\n---\n').line1Ok, false);
  assert.equal(splitFrontmatter('﻿---\nname: x\n---\n').line1Ok, false);
  assert.equal(splitFrontmatter('---\nname: x\n').closed, false);
});

test('validator: project-reference detector', () => {
  const flagged = (line, options) => findProjectRefs(line, options).length > 0;
  for (const line of ['see docs/05-ui.md', 'read design/toybox.html', 'the idea-hunt notes', 'spec.txt section 5', 'SPEC.md', '99-final-decisions', '/Users/someone/x', 'the scratchpad', '${CLAUDE_PROJECT_DIR}/x', '.claude/skills/other-skill/SKILL.md', 'skills/other-skill/references/a.md', 'skills/_library/shared/fonts/x.ttf', '../../docs/x.md']) {
    assert.ok(flagged(line), `should flag: ${line}`);
  }
  for (const line of ['packages/shell/src/design/tokens.ts', 'apps/line-siege/docs/notes.md', 'https://docs.expo.dev/versions/latest/', 'https://reactnative.dev/docs/view', 'node skills/_library/validate-skills.mjs', '${CLAUDE_SKILL_DIR}/scripts/check.mjs', '.claude/settings.json', 'the skills/ folder', 'const re = /docs\\//;']) {
    assert.ok(!flagged(line), `should not flag: ${line}`);
  }
  assert.ok(flagged('see [x](../y.md)', { markdownProse: true }));
  assert.ok(!flagged("import { a } from '../theme';"));
  assert.ok(flagged("readFileSync('../../assets/x')", { script: true }));
  assert.ok(!flagged("new URL('../assets/x', import.meta.url)", { script: true }));
});

test('validator: every case in tests/cases fails with exactly its rule (good cases pass)', () => {
  const tmp = makeTempDir('selftest-cases-');
  try {
    const casesCopy = join(tmp, 'cases');
    cpSync(join(HERE, 'cases'), casesCopy, { recursive: true });
    const cases = listCaseSkills(casesCopy);
    assert.ok(cases.length >= 30, `expected at least 30 cases, found ${cases.length}`);
    const seenRules = new Set();
    for (const item of cases) {
      if (item.meta.sync !== false) {
        const manifest = readManifest(item.dir, SHARED);
        if (manifest.errors.length === 0) syncShared(item.dir, manifest.entries, SHARED);
      }
      const result = node(join(LIB, 'validate-skills.mjs'), ['--json', item.dir], tmp);
      const got = rulesOf(result);
      const want = [...item.meta.rules].sort();
      want.forEach((rule) => seenRules.add(rule));
      assert.deepEqual(got, want, `case ${item.caseId}: expected rules [${want}] got [${got}]\n${result.stdout.slice(0, 3000)}`);
      assert.equal(result.status, want.length ? 1 : 0, `case ${item.caseId}: exit ${result.status}`);
      assert.equal(result.last, want.length ? `RESULT: FAIL (${result.stdout.match(/(\d+) problems\)$/m)?.[1]} problems)` : 'RESULT: PASS');
    }
    const validatorSource = readFileSync(join(LIB, 'validate-skills.mjs'), 'utf8');
    const ruleIds = Object.keys(JSON.parse(spawnSync(process.execPath, ['--input-type=module', '-e', `import { RULES } from ${JSON.stringify(join(LIB, 'validate-skills.mjs'))}; console.log(JSON.stringify(RULES));`], { encoding: 'utf8' }).stdout));
    const untested = ruleIds.filter((rule) => rule !== 'library-layout' && !seenRules.has(rule));
    assert.deepEqual(untested, [], `rules without a planted-bad case: ${untested.join(', ')}`);
    assert.ok(validatorSource.includes("'library-layout'"));
  } finally {
    removeTempDir(tmp);
  }
});

test('validator: library-layout flags stray entries in skills/', () => {
  const tmp = makeTempDir('selftest-layout-');
  try {
    const skills = join(tmp, 'skills');
    mkdirSync(join(skills, '_library'), { recursive: true });
    cpSync(join(HERE, 'cases', 'good-basic', 'good-basic'), join(skills, 'good-basic'), { recursive: true });
    const clean = node(join(LIB, 'validate-skills.mjs'), ['--json', '--skills-root', skills, '--shared', SHARED], tmp);
    assert.equal(clean.status, 0, clean.output);
    write(join(skills, 'notes.txt'), 'stray');
    mkdirSync(join(skills, 'half-made'));
    write(join(skills, 'half-made', 'README.md'), 'no SKILL.md');
    const dirty = node(join(LIB, 'validate-skills.mjs'), ['--json', '--skills-root', skills, '--shared', SHARED], tmp);
    assert.equal(dirty.status, 1);
    assert.match(dirty.stdout, /notes\.txt \[library-layout\] stray file/);
    assert.match(dirty.stdout, /half-made \[library-layout\] folder without SKILL\.md/);
    const empty = join(tmp, 'empty');
    mkdirSync(join(empty, '_library'), { recursive: true });
    const nothing = node(join(LIB, 'validate-skills.mjs'), ['--skills-root', empty], tmp);
    assert.equal(nothing.status, 2, 'no skills at all must exit 2');
  } finally {
    removeTempDir(tmp);
  }
});

test('validator: the skill template passes', () => {
  const result = node(join(LIB, 'validate-skills.mjs'), ['skill-template']);
  assert.equal(result.status, 0, result.output);
  assert.equal(result.last, 'RESULT: PASS');
});

// ---------------------------------------------------------------------------------------------
// 4. sync-shared, link-skills, sources, selftest-all
// ---------------------------------------------------------------------------------------------

test('sync-shared: copies, mirrors folders, detects drift, rejects bad manifests', () => {
  const tmp = makeTempDir('selftest-sync-');
  try {
    const skills = join(tmp, 'skills');
    const shared = join(skills, '_library', 'shared');
    write(join(shared, 'data.json'), '{"a":1}\n');
    write(join(shared, 'fonts', 'a.ttf'), 'A');
    write(join(shared, 'fonts', 'sub', 'b.txt'), 'B');
    write(join(skills, 'alpha', 'SKILL.md'), '---\nname: alpha\n---\n');
    write(join(skills, 'alpha', 'assets', 'shared.json'), JSON.stringify([{ from: 'data.json', to: 'assets/data.json' }, { from: 'fonts/', to: 'assets/fonts/' }]));
    write(join(skills, 'beta', 'SKILL.md'), '---\nname: beta\n---\n');
    const sync = join(LIB, 'sync-shared.mjs');
    const before = node(sync, ['--check', '--skills-root', skills], tmp);
    assert.equal(before.status, 1);
    assert.match(before.stdout, /alpha\/assets\/data\.json \[shared-drift\] missing copy/);
    const first = node(sync, ['--skills-root', skills], tmp);
    assert.equal(first.status, 0, first.output);
    assert.match(first.stdout, /skip {2}beta/);
    assert.equal(readFileSync(join(skills, 'alpha', 'assets', 'fonts', 'sub', 'b.txt'), 'utf8'), 'B');
    assert.equal(node(sync, ['--check', '--skills-root', skills], tmp).status, 0);
    write(join(skills, 'alpha', 'assets', 'data.json'), '{"a":2}\n');
    write(join(skills, 'alpha', 'assets', 'fonts', 'extra.ttf'), 'X');
    const drift = node(sync, ['--check', 'alpha', '--skills-root', skills], tmp);
    assert.equal(drift.status, 1);
    assert.match(drift.stdout, /data\.json \[shared-drift\] differs/);
    assert.match(drift.stdout, /extra\.ttf \[shared-drift\] extra file/);
    assert.equal(node(sync, ['--skills-root', skills], tmp).status, 0);
    assert.ok(!existsSync(join(skills, 'alpha', 'assets', 'fonts', 'extra.ttf')));
    assert.equal(readFileSync(join(skills, 'alpha', 'assets', 'data.json'), 'utf8'), '{"a":1}\n');
    for (const manifest of ['{not json', '{"from":"x"}', '[{"from":"../x","to":"a"}]', '[{"from":"fonts/","to":"assets/fonts"}]', '[{"from":"missing.json","to":"assets/m.json"}]', '[{"from":"data.json","to":"SKILL.md"}]']) {
      write(join(skills, 'beta', 'assets', 'shared.json'), manifest);
      const bad = node(sync, ['beta', '--skills-root', skills], tmp);
      assert.equal(bad.status, 1, `manifest ${manifest} should fail`);
      assert.match(bad.stdout, /\[shared-json\]/);
    }
  } finally {
    removeTempDir(tmp);
  }
});

test('link-skills: creates relative links, removes stale ones, never touches foreign entries', () => {
  const tmp = makeTempDir('selftest-link-');
  try {
    const repo = join(tmp, 'repo');
    for (const name of ['alpha', 'beta']) write(join(repo, 'skills', name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
    write(join(repo, 'skills', 'draft', 'notes.md'), 'no SKILL.md yet');
    mkdirSync(join(repo, 'skills', '_library'), { recursive: true });
    const linkDir = join(repo, '.claude', 'skills');
    mkdirSync(linkDir, { recursive: true });
    symlinkSync('../../skills/gone', join(linkDir, 'gone'));
    symlinkSync(join(tmp, 'elsewhere'), join(linkDir, 'foreign'));
    write(join(linkDir, 'handmade', 'SKILL.md'), '---\nname: handmade\n---\n');
    const link = join(LIB, 'link-skills.mjs');
    const check = node(link, ['--check', '--root', repo], tmp);
    assert.equal(check.status, 1);
    assert.match(check.stdout, /\.claude\/skills\/alpha \[link-missing\]/);
    assert.match(check.stdout, /\.claude\/skills\/gone \[link-stale\]/);
    const made = node(link, ['--root', repo], tmp);
    assert.equal(made.status, 0, made.output);
    assert.equal(readlinkSync(join(linkDir, 'alpha')), '../../skills/alpha');
    assert.equal(readlinkSync(join(linkDir, 'beta')), '../../skills/beta');
    assert.ok(readFileSync(join(linkDir, 'alpha', 'SKILL.md'), 'utf8').includes('name: alpha'));
    assert.ok(!existsSync(join(linkDir, 'gone')) && !readdirSync(linkDir).includes('gone'));
    assert.ok(readdirSync(linkDir).includes('foreign') && existsSync(join(linkDir, 'handmade', 'SKILL.md')));
    assert.ok(!readdirSync(linkDir).includes('draft') && !readdirSync(linkDir).includes('_library'));
    assert.equal(node(link, ['--check', '--root', repo], tmp).status, 0);
    // A real folder in the way is a conflict, never deleted.
    rmSync(join(linkDir, 'beta'));
    write(join(linkDir, 'beta', 'SKILL.md'), 'someone else');
    const conflict = node(link, ['--root', repo], tmp);
    assert.equal(conflict.status, 1);
    assert.match(conflict.stdout, /\.claude\/skills\/beta \[link-conflict\]/);
    assert.equal(readFileSync(join(linkDir, 'beta', 'SKILL.md'), 'utf8'), 'someone else');
    rmSync(join(linkDir, 'beta'), { recursive: true });
    // Copy mode.
    assert.equal(node(link, ['--copy', '--root', repo], tmp).status, 0);
    assert.ok(existsSync(join(linkDir, 'alpha', '.link-skills-copy')));
    assert.equal(node(link, ['--check', '--copy', '--root', repo], tmp).status, 0);
    write(join(repo, 'skills', 'alpha', 'references', 'new.md'), '# New\n');
    assert.equal(node(link, ['--check', '--copy', '--root', repo], tmp).status, 1);
    assert.equal(node(link, ['--copy', '--root', repo], tmp).status, 0);
    assert.ok(existsSync(join(linkDir, 'alpha', 'references', 'new.md')));
    // Back to links: managed copies are replaced by links.
    assert.equal(node(link, ['--root', repo], tmp).status, 0);
    assert.equal(readlinkSync(join(linkDir, 'alpha')), '../../skills/alpha');
    const noSkills = join(tmp, 'empty');
    mkdirSync(join(noSkills, 'skills'), { recursive: true });
    assert.equal(node(link, ['--root', noSkills], tmp).status, 2);
  } finally {
    removeTempDir(tmp);
  }
});

test('record-sources + check-staleness: records hashes and reports changed or missing sources', () => {
  const tmp = makeTempDir('selftest-sources-');
  try {
    const repo = join(tmp, 'repo');
    write(join(repo, 'skills', 'alpha', 'SKILL.md'), '---\nname: alpha\n---\n');
    write(join(repo, 'skills', 'alpha', 'references', 'tokens.md'), '# Tokens\n');
    write(join(repo, 'skills', 'alpha', 'references', 'other.md'), '# Other\n');
    write(join(repo, 'source-a.md'), 'A1');
    write(join(repo, 'nested', 'source-b.json'), '{}');
    const sources = join(tmp, 'sources.json');
    const record = join(LIB, 'record-sources.mjs');
    const staleness = join(LIB, 'check-staleness.mjs');
    const recorded = node(record, ['--root', repo, '--sources', sources, 'alpha', 'references/tokens.md', 'source-a.md', 'nested/source-b.json'], tmp);
    assert.equal(recorded.status, 0, recorded.output);
    const data = JSON.parse(readFileSync(sources, 'utf8'));
    assert.equal(data.version, 1);
    assert.deepEqual(data.skills.alpha['references/tokens.md'].sources.map((source) => source.path), ['nested/source-b.json', 'source-a.md']);
    assert.equal(data.skills.alpha['references/tokens.md'].sources[1].sha256, sha256('A1'));
    assert.equal(node(staleness, ['--root', repo, '--sources', sources], tmp).status, 0);
    const strict = node(staleness, ['--root', repo, '--sources', sources, '--strict'], tmp);
    assert.equal(strict.status, 1);
    assert.match(strict.stdout, /alpha\/references\/other\.md \[untracked-reference\]/);
    write(join(repo, 'source-a.md'), 'A2');
    const stale = node(staleness, ['--root', repo, '--sources', sources], tmp);
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /alpha\/references\/tokens\.md \[stale-source\] source source-a\.md changed/);
    assert.match(stale.stdout, /stale skills: alpha/);
    rmSync(join(repo, 'nested', 'source-b.json'));
    assert.match(node(staleness, ['--root', repo, '--sources', sources], tmp).stdout, /\[missing-source\] source nested\/source-b\.json/);
    // Re-recording with --append keeps the other source.
    write(join(repo, 'nested', 'source-b.json'), '{}');
    assert.equal(node(record, ['--root', repo, '--sources', sources, '--append', 'alpha', 'references/tokens.md', 'source-a.md'], tmp).status, 0);
    assert.equal(node(staleness, ['--root', repo, '--sources', sources], tmp).status, 0);
    for (const args of [['alpha', 'references/nope.md', 'source-a.md'], ['alpha', 'references/tokens.md', 'no-such-source.md'], ['ghost', 'x.md', 'source-a.md'], ['alpha', 'references/tokens.md']]) {
      assert.equal(node(record, ['--root', repo, '--sources', sources, ...args], tmp).status, 2, `record ${args.join(' ')} should exit 2`);
    }
  } finally {
    removeTempDir(tmp);
  }
});

/** Runs a library tool without blocking, so several can overlap. */
function nodeAsync(script, args, cwd, env = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolvePromise({ status, stdout, output: `${stdout}${stderr}` }));
  });
}

test('record-sources: the sources.json lock keeps concurrent writers, breaks a stale lock and times out on a held one', async () => {
  const tmp = makeTempDir('selftest-sources-lock-');
  try {
    const repo = join(tmp, 'repo');
    for (const skill of ['alpha', 'beta', 'gamma']) {
      write(join(repo, 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\n---\n`);
      write(join(repo, 'skills', skill, 'references', 'notes.md'), '# Notes\n');
    }
    write(join(repo, 'source-a.md'), 'A');
    const sources = join(tmp, 'sources.json');
    const lock = `${sources}.lock`;
    const record = join(LIB, 'record-sources.mjs');
    // 1. Two writers at once, each holding the lock for 400 ms after its re-read: both entries survive,
    //    because the second one re-reads the file under the lock after the first one wrote it.
    const [first, second] = await Promise.all(['alpha', 'beta'].map((skill) => nodeAsync(record, ['--root', repo, '--sources', sources, skill, 'references/notes.md', 'source-a.md'], tmp, { SOURCES_LOCK_HOLD_MS: '400' })));
    assert.equal(first.status, 0, first.output);
    assert.equal(second.status, 0, second.output);
    const both = JSON.parse(readFileSync(sources, 'utf8'));
    assert.deepEqual(Object.keys(both.skills).sort(), ['alpha', 'beta']);
    assert.ok(!existsSync(lock), 'the lock is released after the write');
    assert.deepEqual(readdirSync(tmp).filter((name) => name.startsWith('sources.json.')), [], 'no temporary or lock file is left behind');
    // 2. A lock older than 10 minutes (a crashed writer) is broken with a WARN line, and the write goes ahead.
    write(lock, `${JSON.stringify({ token: 'old', pid: 999999, holder: 'record-sources ghost', since: '2026-01-01T00:00:00.000Z' })}\n`);
    const old = (Date.now() - 11 * 60 * 1000) / 1000;
    utimesSync(lock, old, old);
    const broke = node(record, ['--root', repo, '--sources', sources, 'gamma', 'references/notes.md', 'source-a.md'], tmp);
    assert.equal(broke.status, 0, broke.output);
    assert.match(broke.stdout, /WARN sources\.json\.lock held by record-sources ghost \(pid 999999\).*older than 10 minutes; broke it/);
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(sources, 'utf8')).skills).sort(), ['alpha', 'beta', 'gamma']);
    assert.ok(!existsSync(lock));
    // 3. A fresh lock held by another writer is waited for, then the run stops with exit 2 and names the holder;
    //    sources.json is unchanged and the other writer's lock is left alone.
    write(lock, `${JSON.stringify({ token: 'live', pid: 4242, holder: 'record-sources other', since: new Date().toISOString() })}\n`);
    const before = readFileSync(sources, 'utf8');
    const held = node(record, ['--root', repo, '--sources', sources, '--lock-wait', '1', 'alpha', 'references/notes.md', 'source-a.md'], tmp);
    assert.equal(held.status, 2, held.output);
    assert.match(held.output, /sources\.json\.lock is held by record-sources other \(pid 4242\)/);
    assert.match(held.output, /RESULT: FAIL/);
    assert.equal(readFileSync(sources, 'utf8'), before);
    assert.ok(existsSync(lock), 'a fresh lock of another writer is never removed');
    // 4. Released: the same write goes through.
    rmSync(lock);
    assert.equal(node(record, ['--root', repo, '--sources', sources, '--lock-wait', '1', '--append', 'alpha', 'references/notes.md', 'source-a.md'], tmp).status, 0);
  } finally {
    removeTempDir(tmp);
  }
});

test('selftest-all: runs every skill self-test and fails a skill with scripts but no self-test', () => {
  const tmp = makeTempDir('selftest-all-');
  try {
    const skills = join(tmp, 'skills');
    mkdirSync(join(skills, '_library'), { recursive: true });
    cpSync(join(LIB, 'skill-template'), join(skills, 'alpha'), { recursive: true });
    cpSync(CHECK_LIB, join(skills, 'alpha', 'scripts', 'check-lib.mjs'));
    write(join(skills, 'plain', 'SKILL.md'), '---\nname: plain\n---\n');
    const all = join(LIB, 'selftest-all.mjs');
    const good = node(all, ['--skip-library', '--skills-root', skills], tmp);
    assert.equal(good.status, 0, good.output);
    assert.match(good.stdout, /alpha\s+scripts\/selftest\.mjs\s+PASS/);
    assert.match(good.stdout, /plain\s+-\s+SKIP/);
    rmSync(join(skills, 'alpha', 'scripts', 'selftest.mjs'));
    const bad = node(all, ['--skip-library', '--skills-root', skills], tmp);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /alpha \[selftest-missing\]/);
  } finally {
    removeTempDir(tmp);
  }
});

// ---------------------------------------------------------------------------------------------
// 5. Shared files and settings
// ---------------------------------------------------------------------------------------------

test('shared: fonts match fonts/SOURCES.md, and every listed file exists', () => {
  const sourcesMd = readFileSync(join(SHARED, 'fonts', 'SOURCES.md'), 'utf8');
  const rows = [...sourcesMd.matchAll(/^\| `([^`]+)` \|[^\n]*\| `([0-9a-f]{64})` \|$/gm)];
  assert.ok(rows.length >= 9, `expected 9 hashed rows in SOURCES.md, found ${rows.length}`);
  for (const [, file, hash] of rows) assert.equal(sha256(readFileSync(join(SHARED, 'fonts', file))), hash, `${file} does not match its sha256 in SOURCES.md`);
  const listed = new Set(rows.map((row) => row[1]));
  for (const file of readdirSync(join(SHARED, 'fonts')).filter((name) => name !== 'SOURCES.md' && !name.startsWith('.'))) assert.ok(listed.has(file), `${file} is not in SOURCES.md`);
  for (const file of ['LilitaOne.ttf', 'Rubik-Regular.ttf', 'Rubik-Medium.ttf', 'Rubik-Bold.ttf', 'Vazirmatn-Regular.ttf', 'Vazirmatn-Bold.ttf']) assert.ok(listed.has(file), `${file} missing`);
});

test('shared: data copies parse and hold no project paths', () => {
  for (const file of ['toybox-tokens.json', 'copy-deck.json']) {
    const text = readFileSync(join(SHARED, file), 'utf8');
    JSON.parse(text);
    text.split('\n').forEach((line, i) => assert.deepEqual(findProjectRefs(line), [], `${file}:${i + 1} names a project path`));
  }
  assert.equal(sanitize('see docs/18-design-system-toybox.md and design/toybox.html, docs/10, spec.txt'), 'see handbook chapter 18 (design system toybox) and the Toybox HTML mockup, handbook chapter 10, the product spec');
});

test('settings.proposed.json: budget key and script allow rules', () => {
  const settings = JSON.parse(readFileSync(join(LIB, 'settings.proposed.json'), 'utf8'));
  assert.equal(typeof settings.skillListingBudgetFraction, 'number');
  assert.ok(settings.skillListingBudgetFraction > 0 && settings.skillListingBudgetFraction <= 1);
  assert.ok(settings.permissions.allow.includes('Bash(node */.claude/skills/*/scripts/*)'));
  assert.ok(settings.permissions.allow.includes('Bash(node skills/_library/*)'));
});

// ---------------------------------------------------------------------------------------------

run(async () => {
  parseArgs(process.argv.slice(2), {
    name: 'selftest',
    summary: 'The skill library\'s own self-test: check-lib, the validator (every planted-bad case), sync-shared, link-skills, the sources tools, selftest-all, and the shared files.',
    usage: '',
    positionals: { min: 0, max: 0 },
  });
  const report = createReporter({ name: 'library selftest' });
  for (const { name, fn } of tests) {
    const started = Date.now();
    try {
      await fn();
      console.log(`ok   ${name} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (error) {
      report.problem({ file: 'tests/selftest.mjs', rule: 'library-test', message: `${name}: ${error.message}`, fix: 'Fix the library tool (or the case) this test exercises, then rerun.' });
    }
  }
  return report.finish({ checked: tests.length, unit: 'tests' });
});
