#!/usr/bin/env node
// check-test-code.mjs: checks how Pocket Arcade tests use React Native Testing Library 14, the root
// vendor mocks, fakes and workspace imports: every async RNTL call awaited, components rendered
// through renderWithShell, queries used for what they prove, no style assertions without a reason,
// no SDK imports in tests, no mocked stores, no fake timers in logic, no sleeps.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-test-code.mjs [repo-root]

import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

import { REPO_SCAN_IGNORES, createReporter, lineOf, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-test-code',
  summary: 'Checks every test file under apps/, packages/ and test/ for the RNTL 14, mock and fake rules of the unit-and-component-tests skill.',
  usage: '[options] [repo-root]',
  options: {
    ignore: { type: 'string', multiple: true, value: 'glob', help: 'Skip matching paths' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules (test files are *.test.ts(x), *.golden.test.ts and *.sim.test.ts):',
    '  rntl-await                an RNTL call (render, renderWithShell, renderHook, act, waitFor, fireEvent, findBy*,',
    '                            user.press/type/..., rerender, unmount) is not awaited (RNTL 14 is async)',
    '  render-with-shell         a component test under apps/ or packages/ renders with RNTL render() instead of renderWithShell',
    '  destructured-queries      queries destructured from render(); use screen.getByRole(...)',
    '  user-event-setup          userEvent.press(...) without userEvent.setup()',
    '  query-for-presence        expect(queryBy...(...)) asserts presence; use getBy* (queryBy* is only for absence)',
    '  get-for-absence           expect(getBy...(...)).not.toBeOnTheScreen(); getBy throws first, use queryBy*',
    '  waitfor-side-effect       a press or fireEvent inside a waitFor callback',
    '  render-hook-wrapper       renderHook(...) without a wrapper (hooks read the Shell through createShellWrapper)',
    '  style-assertion           toHaveStyle(...) outside packages/shell/src/ui/ and packages/shell/src/i18n/ (where',
    '                            Toybox measurements, the 44 pt box and the <T> contract are asserted) without',
    '                            "// allow-style-assertion: <reason>" on the line above or in the file header',
    '  vendor-sdk-import         a test imports react-native-google-mobile-ads or expo-iap (use jest.mock + jest.requireMock)',
    '  require-mock-without-mock jest.requireMock("<m>") without jest.mock("<m>") in the same file (second instance, zero calls)',
    '  mocked-store              jest.mock(...) of a store module (seed through renderWithShell and dispatch instead)',
    '  fake-timers-in-logic      jest.useFakeTimers() in a rules, levels, game-kit, service or store test (inject the clock)',
    '  test-sleep                a sleep in a test (new Promise + setTimeout, sleep(), delay(), wait())',
    '  cross-workspace-import    a relative import that leaves the test\'s workspace (import by @e07/<package>/ name)',
    '',
    'Reasoned opt-outs (a comment anywhere in the file, the reason at least 10 characters):',
    '  // no-shell-context: <why>     render-with-shell and render-hook-wrapper: the unit reads nothing from',
    '                                 the Shell (props or injected dependencies only, or its own provider)',
    '  // allow-fake-timers: <why>    fake-timers-in-logic: the unit under test is itself a timer (a timeout helper)',
    '  // allow-style-assertion: <why> style-assertion: the style is the contract (line above, or file header)',
    'A render(...) or renderHook(...) that passes its own { wrapper } needs no marker.',
  ].join('\n'),
};

// The shared repo-scan ignores (skills/, .claude/, node_modules, Pods, each app's generated ios/, android/,
// build/, out/) plus generated reports.
const IGNORE = [...REPO_SCAN_IGNORES, 'apps/*/dist/**', 'reports/**', 'coverage/**', 'tools/**', 'dist-audit/**', '.stryker-tmp/**'];
const TEST_FILE = /\.(test|golden\.test|sim\.test)\.(ts|tsx)$/;
const SDKS = ['react-native-google-mobile-ads', 'expo-iap'];
const USER_METHODS = 'press|longPress|type|clear|paste|scrollTo';
const LOGIC_PATH = /^(apps\/[^/]+\/src\/(rules|levels|sim)\/|packages\/game-kit\/src\/|packages\/shell\/src\/(services|stores)\/)/;
/** Folders whose tests assert styles as the contract: Toybox component measurements and the <T> contract. */
const STYLE_CONTRACT_PATH = /^packages\/shell\/src\/(ui|i18n)\//;

/** A file-level opt-out: `// <marker>: <reason of at least 10 characters>` anywhere in the source. */
function hasMarker(source, marker) {
  const match = new RegExp(`//\\s*${marker}:\\s*(.+)$`, 'm').exec(source);
  return match !== null && match[1].trim().length >= 10;
}

/** Index just after the parenthesised group that starts at `open` (which must be "("), or -1. */
function closeParen(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) j += code[j] === '\\' ? 2 : 1;
      i = j;
    } else if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function importedNames(code, from) {
  const names = new Set();
  for (const match of code.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    if (!from(match[2])) continue;
    for (const part of match[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

function isAwaited(code, index) {
  let start = index;
  while (start > 0 && /[\w$.]/.test(code[start - 1])) start -= 1;
  const before = code.slice(Math.max(0, start - 40), start);
  if (/\bawait\s*$/.test(before) || /\breturn\s*$/.test(before)) return true;
  return /\bexpect\s*\(\s*$/.test(before);
}

function checkAwaits(code, rel, report) {
  const rntl = importedNames(code, (source) => source === '@testing-library/react-native');
  const shell = importedNames(code, (source) => source.endsWith('render-with-shell.tsx') || source.endsWith('render-with-shell'));
  const calls = [];
  for (const name of ['render', 'renderHook', 'act', 'waitFor', 'rerender', 'unmount']) if (rntl.has(name) || (name === 'rerender' || name === 'unmount') && rntl.size > 0) calls.push(`(?<![\\w.$])${name}`);
  if (shell.has('renderWithShell')) calls.push('(?<![\\w.$])renderWithShell');
  if (rntl.has('fireEvent')) calls.push('(?<![\\w.$])fireEvent(?:\\.\\w+)?');
  for (const match of code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*userEvent\.setup\s*\(/g)) calls.push(`(?<![\\w.$])${match[1]}\\.(?:${USER_METHODS})`);
  calls.push('(?<![\\w$])(?:screen\\.)?find(?:All)?By[A-Z]\\w*');
  const pattern = new RegExp(`(?:${calls.join('|')})\\s*(?:<[^>()]*>)?\\s*\\(`, 'g');
  for (const match of code.matchAll(pattern)) {
    const head = code.slice(Math.max(0, match.index - 20), match.index);
    if (/\b(function|async function)\s*$/.test(head) || /\bfunction\s+\w*$/.test(head)) continue;
    if (!isAwaited(code, match.index)) {
      const name = match[0].replace(/\s*(<[^>()]*>)?\s*\($/, '');
      report.problem({ file: rel, line: lineOf(code, match.index), rule: 'rntl-await', message: `${name}(...) is not awaited`, fix: `Write await ${name}(...) (RNTL 14 returns promises); an un-awaited call runs after the assertions.` });
    }
  }
  return { rntl, shell };
}

/** True when every render(...) call of the file passes its own { wrapper } (a provider tree the test builds). */
function everyRenderHasWrapper(code) {
  const calls = [...code.matchAll(/(?<![\w.$])render\s*(?:<[^>()]*>)?\s*\(/g)];
  return calls.length > 0 && calls.every((match) => {
    const open = match.index + match[0].length - 1;
    const close = closeParen(code, open);
    return close !== -1 && /\bwrapper\b/.test(code.slice(open, close));
  });
}

function checkRender(code, source, rel, rntl, report) {
  const isComponentTest = rel.endsWith('.test.tsx') && /^(apps|packages)\//.test(rel) && !rel.includes('/testing/');
  if (isComponentTest && rntl.has('render') && !hasMarker(source, 'no-shell-context') && !everyRenderHasWrapper(code)) {
    const at = code.search(/import\s+\{[^}]*\brender\b[^}]*\}\s*from\s*['"]@testing-library\/react-native['"]/);
    report.problem({ file: rel, line: lineOf(code, Math.max(at, 0)), rule: 'render-with-shell', message: 'renders with RNTL render() instead of renderWithShell', fix: 'Use await renderWithShell(<X />, options) from @e07/shell/testing/render-with-shell.tsx: real catalog, seeded stores, only the ports the test passes. Only if the component reads nothing from the Shell (props only), keep render() and add "// no-shell-context: <why>" to the file.' });
  }
  for (const match of code.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=\s*(?:await\s+)?(?:render|renderWithShell)\s*\(/g)) {
    if (/\b(?:get|query|find)(?:All)?By\w+/.test(match[1])) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'destructured-queries', message: 'queries are destructured from the render result', fix: 'Query through screen (screen.getByRole(...)); destructure only stores or rerender/unmount.' });
  }
  for (const match of code.matchAll(new RegExp(`\\buserEvent\\.(?:${USER_METHODS})\\s*\\(`, 'g'))) {
    report.problem({ file: rel, line: lineOf(code, match.index), rule: 'user-event-setup', message: `${match[0].replace(/\s*\($/, '')}(...) is called without a setup() instance`, fix: 'const user = userEvent.setup(); then await user.press(...).' });
  }
}

function checkExpectations(code, source, rel, report) {
  for (const match of code.matchAll(/\bexpect\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    const close = closeParen(code, open);
    if (close === -1) continue;
    const arg = code.slice(open + 1, close - 1).trim();
    const chain = code.slice(close, close + 40);
    const isQuery = /^(?:await\s+)?(?:screen\.)?queryBy\w+\s*\(/.test(arg);
    const isGet = /^(?:screen\.)?get(?:All)?By\w+\s*\(/.test(arg);
    const absence = /^\s*\.(?:not\s*\.\s*toBeOnTheScreen|toBeNull|toBeFalsy)\s*\(/.test(chain);
    if (isQuery && !absence) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'query-for-presence', message: `expect(${arg.split('(')[0]}(...)) asserts something other than absence`, fix: 'Use getBy* (or await findBy*) for presence; keep queryBy* for .not.toBeOnTheScreen().' });
    if (isGet && absence) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'get-for-absence', message: `expect(${arg.split('(')[0]}(...)) checks absence, but getBy* throws before the assertion`, fix: 'Use expect(screen.queryBy...(...)).not.toBeOnTheScreen().' });
  }
  for (const match of code.matchAll(/(?<![\w.$])waitFor\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    const close = closeParen(code, open);
    if (close !== -1 && /\.(?:press|longPress|type|clear|paste)\s*\(|\bfireEvent\b/.test(code.slice(open, close))) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'waitfor-side-effect', message: 'a press or fireEvent runs inside waitFor', fix: 'Do the action first (await user.press(...)), then wait with await screen.findBy...(...) or one assertion in waitFor.' });
  }
  const hookNeedsNoShell = hasMarker(source, 'no-shell-context');
  for (const match of code.matchAll(/(?<![\w.$])renderHook\s*(?:<[^>()]*>)?\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    const close = closeParen(code, open);
    if (close !== -1 && !hookNeedsNoShell && !/\bwrapper\b/.test(code.slice(open, close))) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'render-hook-wrapper', message: 'renderHook(...) has no wrapper', fix: 'Pass { wrapper } from createShellWrapper(options) so the hook sees the stores, theme, i18n and ports. Only if the hook reads nothing from the Shell (injected dependencies only), add "// no-shell-context: <why>" to the file.' });
  }
}

function checkStyle(code, source, rel, report) {
  if (STYLE_CONTRACT_PATH.test(rel)) return;
  const lines = source.split('\n');
  const header = lines.slice(0, 15).join('\n');
  const reasoned = (text) => {
    const allow = /allow-style-assertion:\s*(.+)$/m.exec(text);
    return allow !== null && allow[1].trim().length >= 10;
  };
  if (reasoned(header)) return;
  for (const match of code.matchAll(/\.toHaveStyle\s*\(/g)) {
    const line = lineOf(code, match.index);
    const nearby = `${lines[line - 2] ?? ''}\n${lines[line - 1] ?? ''}`;
    if (!reasoned(nearby)) report.problem({ file: rel, line, rule: 'style-assertion', message: 'asserts a style', fix: 'Assert visible text, role or accessible name; screens and game code leave looks to the screenshots. Where the style itself is the contract (a mirrored board direction, a slider fill), add "// allow-style-assertion: <why>" on the line above or in the file header.' });
  }
}

function checkMocks(code, rel, report) {
  for (const sdk of SDKS) {
    const quoted = `['"]${sdk.replace(/[-/]/g, (ch) => `\\${ch}`)}(?:\\/[^'"]*)?['"]`;
    const importRe = new RegExp(`(?:\\bfrom\\s*${quoted}|(?<![\\w.$])(?:require|import)\\s*\\(\\s*${quoted}|^\\s*import\\s+${quoted})`, 'gm');
    for (const match of code.matchAll(importRe)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'vendor-sdk-import', message: `the test imports ${sdk}`, fix: `Write jest.mock('${sdk}') and read it with jest.requireMock<Typed>('${sdk}'); only the adapter imports the SDK.` });
  }
  for (const match of code.matchAll(/\bjest\.requireMock\s*(?:<[^>()]*(?:<[^>()]*>)?[^>()]*>)?\s*\(\s*['"]([^'"]+)['"]/g)) {
    const name = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`\\bjest\\.mock\\s*\\(\\s*['"]${name}['"]`).test(code)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'require-mock-without-mock', message: `jest.requireMock('${match[1]}') without jest.mock('${match[1]}')`, fix: `Add jest.mock('${match[1]}'); at the top: without it requireMock returns a second instance and assertions see zero calls.` });
  }
  for (const match of code.matchAll(/\bjest\.mock\s*\(\s*['"]([^'"]+)['"]/g)) {
    if (/^(?:\.|@e07\/)/.test(match[1]) && /\/stores?\/|[-/]store(?:\.tsx?)?$/.test(match[1])) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'mocked-store', message: `jest.mock('${match[1]}') mocks a store`, fix: 'Seed state with renderWithShell({ settings, isPremium }) and change it with await act(() => { stores.x.getState().dispatch(...) }).' });
  }
}

function checkTiming(code, source, rel, report) {
  if (LOGIC_PATH.test(rel) && !hasMarker(source, 'allow-fake-timers')) {
    for (const match of code.matchAll(/\bjest\.useFakeTimers\s*\(/g)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'fake-timers-in-logic', message: 'fake timers in a logic test', fix: 'Inject ClockPort (a fake clock) or pass timestamps; fake timers are only for UI timers inside components.' });
  }
  const sleeps = /new\s+Promise\s*(?:<[^>()]*>)?\s*\(\s*\(?\s*\w*\s*\)?\s*=>\s*\{?\s*(?:setTimeout|setInterval)\s*\(|\bawait\s+(?:sleep|delay|wait)\s*\(/g;
  for (const match of code.matchAll(sleeps)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'test-sleep', message: 'the test sleeps', fix: 'Wait for a result instead: await screen.findBy...(...), or await flushMicrotasks() for settled promises.' });
}

function checkImports(code, rel, report) {
  const workspace = /^(apps|packages)\/[^/]+\//.exec(rel)?.[0] ?? (rel.startsWith('test/') ? 'test/' : null);
  if (workspace === null) return;
  for (const match of code.matchAll(/(?:\bfrom\s*|(?<![\w.$])(?:import|require|jest\.mock|jest\.requireActual)\s*\(\s*)['"](\.{1,2}\/[^'"]*)['"]/g)) {
    const target = posix.normalize(posix.join(posix.dirname(rel), match[1]));
    const leaves = workspace === 'test/' ? /^(apps|packages)\//.test(target) : !target.startsWith(workspace);
    if (leaves) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'cross-workspace-import', message: `imports ${match[1]} (${target}) across workspaces by a relative path`, fix: 'Import by package name (@e07/<package>/<path>.ts); jest.config.js maps it to the source, so Stryker mutates the file the test runs.' });
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const report = createReporter({ name: SPEC.name, json: options.json });
  const files = walk(root, { include: ['*.test.ts', '*.test.tsx'], ignore: [...IGNORE, ...options.ignore] }).filter((rel) => TEST_FILE.test(rel) && /^(apps|packages|test)\//.test(rel));
  for (const rel of files) {
    const source = readFileSync(join(root, rel), 'utf8');
    const code = maskComments(source);
    const { rntl } = checkAwaits(code, rel, report);
    checkRender(code, source, rel, rntl, report);
    checkExpectations(code, source, rel, report);
    checkStyle(code, source, rel, report);
    checkMocks(code, rel, report);
    checkTiming(code, source, rel, report);
    checkImports(code, rel, report);
  }
  return report.finish({ checked: files.length, unit: 'test files' });
});
