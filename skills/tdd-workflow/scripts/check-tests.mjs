#!/usr/bin/env node
// check-tests.mjs: checks the test discipline of a Pocket Arcade repo: no skipped or focused tests,
// no retries, third-person-verb titles, no component snapshots, no clock or randomness in tests,
// no Node APIs in app-world tests, test files named and placed right, and every logic module tested.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-tests.mjs [repo-root]

import { existsSync } from 'node:fs';
import { basename, dirname, join, posix, relative } from 'node:path';

import { REPO_SCAN_IGNORES, createReporter, lineOf, maskComments, matchGlob, parseArgs, readText, requireDir, run, toPosix, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-tests',
  summary: 'Checks test files and logic modules against the TDD rules: every logic module has a test, and tests are named, placed and written so they stay deterministic and honest.',
  usage: '[options] [repo-root]',
  options: {
    logic: { type: 'string', multiple: true, value: 'glob', help: 'Logic-module globs that need a test (replaces the default list)' },
    ignore: { type: 'string', multiple: true, value: 'glob', help: 'Skip matching paths' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules (test files are *.test.ts(x), *.golden.test.ts, *.sim.test.ts):',
    '  disabled-test            .only / .skip / .failing / .todo, xit, xdescribe, fit, fdescribe',
    '  test-retry               jest.retryTimes (a retry hides a flaky test)',
    '  use-it                   test(...) instead of it(...)',
    '  test-title-verb          it() title does not start with a third-person verb or "can" (^(can|[a-z]+s)\\b)',
    '  describe-generic         describe("tests"), describe("misc"): use the exported name',
    '  component-snapshot       a snapshot matcher outside *.golden.test.ts',
    '  test-nondeterminism      Math.random, Date.now, new Date(), performance.now in a test (a perf budget test,',
    '                           test/**/<name>.perf.test.ts, may time with performance from node:perf_hooks)',
    '  node-api-in-app-test     a node: or Node built-in import in a test under apps/*/src or packages/{game-kit,shell}/src',
    '  test-file-name           *.spec.ts(x) or a __tests__ folder',
    '  test-without-assertion   a test file with no expect( or fc.assert(',
    '  untested-module          a logic module with runtime exports that no test imports and that has no sibling test',
    '  device-only-reason       a "// device-only:" line (in the first 6 lines) that does not name the check covering it',
    '',
    'Default logic globs: packages/game-kit/src/**, packages/shell/src/services/**, packages/shell/src/stores/**,',
    '  packages/shell/src/game-host/**, apps/*/src/rules/**, apps/*/src/levels/** (.ts files; fakes, testing/,',
    '  fixtures/ and type-only or constants-only modules are exempt).',
    'A thin device-only wrapper Jest cannot load (the expo-sqlite driver) is exempt when',
    'its first lines hold "// device-only: covered by <the simulator or end-to-end check that exercises it>".',
    'The same marker takes the file out of Jest coverage (jest.config.js, through device-only.ts) and out of',
    'check-test-edits\' code-without-test rule.',
    'The repo scan skips skills/, .claude/, node_modules, Pods and each app\'s generated ios/, android/, build/, out/.',
  ].join('\n'),
};

// The shared repo-scan ignores (skills/, .claude/, node_modules, Pods, each app's generated ios/, android/,
// build/, out/) plus generated reports; packages/tooling/src/build/ is still scanned.
const IGNORE = [...REPO_SCAN_IGNORES, 'apps/*/dist/**', 'dist/**', 'dist-audit/**', 'coverage/**', 'reports/**', '.stryker-tmp/**', 'tools/**'];
const DEFAULT_LOGIC = [
  'packages/game-kit/src/**',
  'packages/shell/src/services/**',
  'packages/shell/src/stores/**',
  'packages/shell/src/game-host/**',
  'apps/*/src/rules/**',
  'apps/*/src/levels/**',
];
const TEST_FILE = /\.(test|golden\.test|sim\.test)\.(ts|tsx)$/;
const APP_WORLD = /^(apps\/[^/]+\/src|packages\/(game-kit|shell)\/src)\//;
const NODE_BUILTINS = ['assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'fs/promises', 'http', 'https', 'net', 'os', 'path', 'process', 'stream', 'url', 'util', 'worker_threads', 'zlib'];
const TITLE_VERB = /^(can|[a-z]+s)\b/;
const RUNTIME_EXPORT = /^export\s+(?:async\s+)?function\b|^export\s+(?:abstract\s+)?class\b|^export\s+const\s+\w+\s*(?::[^=\n]+)?=\s*(?:async\s*)?(?:<[^>]*>\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=\n]+)?=>|^export\s+const\s+\w+\s*=\s*(?:async\s+)?function\b|^export\s+const\s+\w+\s*(?::[^=\n]+)?=\s*[A-Za-z_$][\w$]*\s*(?:<[^>]*>)?\(/m;

const CHECKS = [
  { rule: 'disabled-test', re: /\b(?:it|test|describe)\.(?:only|skip|failing|todo)\b|(?<![\w.$])(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(/g, message: (m) => `"${m}" disables or focuses tests`, fix: 'Remove it: finish the behaviour in this slice or delete the test; skipped tests rot and focused tests hide the rest.' },
  { rule: 'test-retry', re: /\bjest\.retryTimes\s*\(/g, message: () => 'jest.retryTimes hides a flaky test', fix: 'Reproduce with --randomize --seed=<n> -i and fix the cause (shared state, real timers, time zone, unawaited promise).' },
  { rule: 'use-it', re: /(?<![\w.$])test(?:\.each\b[\s\S]{0,400}?\)\s*)?\(\s*['"`]/g, message: () => 'test(...) is used instead of it(...)', fix: 'Write it("<third-person verb> ...") so titles read as the spec.' },
  { rule: 'component-snapshot', re: /\.(?:toMatchSnapshot|toMatchInlineSnapshot|toThrowErrorMatchingSnapshot|toThrowErrorMatchingInlineSnapshot|toMatchImageSnapshot)\s*\(/g, skip: (rel) => rel.endsWith('.golden.test.ts'), message: (m) => `${m.replace(/\s*\($/, '')} outside a *.golden.test.ts file`, fix: 'Assert roles, names and visible text; readable data snapshots belong in <unit>.golden.test.ts only.' },
  { rule: 'test-nondeterminism', re: /\bMath\.random\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bperformance\.now\s*\(/g, allow: (rel, match, code) => isPerfTiming(rel, match, code), message: (m) => `${m.replace(/\s*\($/, '(')} reads real time or randomness`, fix: 'Use the fake clock port, a fixed date string, or the seeded random-number generator.' },
];

/**
 * A perf budget test (the save-write p95 test) must time real work: it lives under the root test/
 * folder as <name>.perf.test.ts and times with performance.now() from node:perf_hooks (the React
 * Native Jest preset replaces the global one with a 1 ms mock). Only that call is allowed there.
 */
function isPerfTiming(rel, match, code) {
  return /^test\/.+\.perf\.test\.ts$/.test(rel) && /^performance\.now/.test(match) && /import\s*\{[^}]*\bperformance\b[^}]*\}\s*from\s*['"]node:perf_hooks['"]/.test(code);
}

/** Index just after the parenthesised group that starts at `open` (which must be "("). */
function closeParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = text.indexOf(ch, i + 1);
      i = end === -1 ? text.length : end;
    } else if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function titles(code, callee) {
  const out = [];
  const plain = new RegExp(String.raw`(?<![\w.$])${callee}\s*\(\s*(['"\`])((?:\\.|(?!\1)[^\\])*)\1`, 'g');
  for (const match of code.matchAll(plain)) out.push({ index: match.index, title: match[2] });
  const each = new RegExp(String.raw`(?<![\w.$])${callee}\.each\s*\(`, 'g');
  for (const match of code.matchAll(each)) {
    const after = closeParen(code, match.index + match[0].length - 1);
    if (after === -1) continue;
    const call = /^\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/.exec(code.slice(after));
    if (call) out.push({ index: match.index, title: call[2] });
  }
  return out;
}

function resolveImport(fromRel, spec) {
  if (spec.startsWith('./')) return posix.normalize(posix.join(posix.dirname(fromRel), spec));
  const pkg = /^@e07\/(game-kit|shell|tooling)\/(.+)$/.exec(spec);
  if (pkg) return `packages/${pkg[1]}/src/${pkg[2]}`;
  const app = /^@e07\/([^/]+)\/(.+)$/.exec(spec);
  if (app) return `apps/${app[1]}/src/${app[2]}`;
  return null;
}

function checkTestFile(report, rel, source, shown, importedByTests) {
  const code = maskComments(source);
  const at = (index) => lineOf(code, index);
  for (const check of CHECKS) {
    if (check.skip?.(rel)) continue;
    for (const match of code.matchAll(check.re)) {
      if (check.allow?.(rel, match[0], code)) continue;
      report.problem({ file: shown, line: at(match.index), rule: check.rule, message: check.message(match[0]), fix: check.fix });
    }
  }
  for (const { index, title } of titles(code, 'it')) {
    if (!TITLE_VERB.test(title)) report.problem({ file: shown, line: at(index), rule: 'test-title-verb', message: `it("${title.slice(0, 60)}") does not start with a third-person verb or "can"`, fix: 'Start with what the unit does: "returns ...", "emits ...", "keeps ...", "shows ..." (never "should ...").' });
  }
  for (const { index, title } of titles(code, 'describe')) {
    if (/^(tests?|unit tests?|misc|stuff|specs?|all|main)$/i.test(title.trim())) report.problem({ file: shown, line: at(index), rule: 'describe-generic', message: `describe("${title}") says nothing`, fix: 'Name the outer describe after the exported unit (describe("applyMove")) and inner ones after the condition (describe("when ...")).' });
  }
  if (APP_WORLD.test(rel)) {
    for (const match of code.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"])([^'"]+)\1/g)) {
      const spec = match[2];
      if (spec.startsWith('node:') || NODE_BUILTINS.includes(spec)) report.problem({ file: shown, line: at(match.index), rule: 'node-api-in-app-test', message: `imports "${spec}" in an app-world test`, fix: 'Move the test and its Node helper under the root test/ folder (test/integration/<area>/, test/goldens/, test/sims/<game-id>/).' });
    }
  }
  if (!/\bexpect\s*\(|\bfc\.assert\s*\(|\bexpect\.assertions\s*\(/.test(code)) report.problem({ file: shown, line: 1, rule: 'test-without-assertion', message: 'the test file never calls expect( or fc.assert(', fix: 'Assert the behaviour; a test without an assertion passes whatever the code does.' });
  for (const match of code.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bjest\.mock\s*\(\s*)(['"])([^'"]+)\1/g)) {
    const target = resolveImport(rel, match[2]);
    if (target) importedByTests.add(target);
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const report = createReporter({ name: 'check-tests', json: options.json });
  const shownOf = (rel) => toPosix(relative(process.cwd(), join(root, rel))) || rel;
  const logicGlobs = options.logic?.length ? options.logic : DEFAULT_LOGIC;
  const files = walk(root, { include: ['*.ts', '*.tsx'], ignore: [...IGNORE, ...(options.ignore ?? [])] });
  const importedByTests = new Set();
  let checked = 0;
  for (const rel of files) {
    const shown = shownOf(rel);
    if (/\.spec\.tsx?$/.test(rel) || rel.split('/').includes('__tests__')) {
      checked += 1;
      report.problem({ file: shown, line: 1, rule: 'test-file-name', message: 'test files are <unit>.test.ts(x) next to the unit', fix: 'Rename to <unit>.test.ts(x) and move it next to the unit; Jest only runs *.test.ts(x), *.golden.test.ts and *.sim.test.ts.' });
      continue;
    }
    if (!TEST_FILE.test(rel)) continue;
    const source = readText(join(root, rel));
    if (source === null) continue;
    checked += 1;
    checkTestFile(report, rel, source, shown, importedByTests);
  }
  for (const rel of files) {
    if (TEST_FILE.test(rel) || !rel.endsWith('.ts') || rel.endsWith('.d.ts')) continue;
    if (!logicGlobs.some((glob) => matchGlob(rel, glob))) continue;
    if (/(^|\/)(testing|fixtures|__mocks__)\//.test(rel) || /^fake-/.test(basename(rel))) continue;
    const source = readText(join(root, rel));
    if (source === null) continue;
    checked += 1;
    if (!RUNTIME_EXPORT.test(maskComments(source))) continue;
    const deviceOnly = /^\/\/\s*device-only:(.*)$/m.exec(source.split('\n').slice(0, 6).join('\n'));
    if (deviceOnly) {
      if (!/\bcovered by\s+\S.{8,}/i.test(deviceOnly[1])) report.problem({ file: shownOf(rel), line: lineOf(source, deviceOnly.index), rule: 'device-only-reason', message: `"${deviceOnly[0].trim().slice(0, 60)}" does not name the check that covers it`, fix: 'Write "// device-only: covered by <the simulator kill test, the e2e flow ...>", or better, write a test through a fake or the root mock.' });
      continue;
    }
    const stem = rel.replace(/\.ts$/, '');
    const hasSibling = ['.test.ts', '.test.tsx', '.golden.test.ts'].some((suffix) => existsSync(join(root, `${stem}${suffix}`)));
    if (hasSibling || importedByTests.has(rel)) continue;
    report.problem({ file: shownOf(rel), line: 1, rule: 'untested-module', message: `${basename(rel)} has runtime exports but no test imports it`, fix: `Write ${basename(stem)}.test.ts next to it, starting with one failing test for its main behaviour (see ${dirname(rel)}).` });
  }
  return report.finish({ checked, unit: 'test files and logic modules' });
});
