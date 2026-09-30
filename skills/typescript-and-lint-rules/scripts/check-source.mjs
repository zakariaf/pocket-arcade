#!/usr/bin/env node
// check-source.mjs: checks TypeScript sources for the code rules that must hold even before
// node_modules exist: no silenced gates, the size limits, no non-erasable syntax, named exports,
// explicit import extensions, no "../", synchronous handlers, no floating void.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-source.mjs [repo-root]

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, matchGlob, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { codeLineCount, functionsOf, importsOf, paramListsOf, scanSource } from './lib/source-scan.mjs';
import { workspacePackageNames } from './lib/workspaces.mjs';

const SPEC = {
  name: 'check-source',
  summary:
    'Checks every .ts/.tsx file of the app repo for the rules of the canonical ESLint and tsconfig set that an agent ' +
    'is most likely to break or silence: inline disables, @ts-ignore, the size limits, enum/namespace/interface, ' +
    'default exports, any, import extensions and "../", async handlers, floating void, empty catch, console.log.',
  usage: '[options] [repo-root]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules (the ESLint rule each mirrors is in brackets):',
    '  no-inline-config        eslint-disable/-enable, /* eslint */, /* global */ comments   [linterOptions.noInlineConfig]',
    '  no-ts-ignore            @ts-ignore or @ts-nocheck                                   [ban-ts-comment]',
    '  ts-expect-error-reason  @ts-expect-error without a description of 10+ characters    [ban-ts-comment]',
    '  no-warning-comment      a comment starting with TODO, FIXME, XXX or HACK             [no-warning-comments]',
    '  max-lines               more than 250 code lines (400 in tests)                      [max-lines]',
    '  max-lines-per-function  a function over 40 code lines (.ts) or 80 (.tsx); not tests  [max-lines-per-function]',
    '  max-params              more than 3 parameters (functions and function types)        [max-params]',
    '  no-enum                 an enum                                                      [TSEnumDeclaration, erasableSyntaxOnly]',
    '  no-namespace            a namespace or module block outside *.d.ts                   [erasableSyntaxOnly]',
    '  no-interface            an interface outside *.d.ts                                  [consistent-type-definitions]',
    '  no-parameter-property   a constructor parameter property                             [erasableSyntaxOnly]',
    '  no-default-export       export default outside app.config.ts, plugins/, __mocks__/   [import/no-default-export]',
    '  no-explicit-any         the any type                                                 [no-explicit-any]',
    '  no-non-null-assertion   value! outside tests                                         [no-non-null-assertion]',
    '  import-extension        ./x or @scope/pkg/x without .ts/.tsx/.json                   [importExtension]',
    '  no-parent-import        an import from "../"                                         [PARENT_IMPORT]',
    '  sync-handler            an async handleX function or async inline on* handler       [asyncHandler]',
    '  no-void-promise         void task() used to drop a promise                           [no-floating-promises]',
    '  no-empty-catch          catch {} with nothing inside                                 [no-empty]',
    '  throw-error-object      throw of a string or template literal                        [only-throw-error]',
    '  no-console-log          console.log/info/debug outside tooling and config            [no-console]',
    '',
    'Scans apps/, packages/, test/, __mocks__/ and root .ts files, except node_modules, ios/, android/, .expo/ and build output.',
    'Example: node check-source.mjs .            (from the app repo root)',
  ].join('\n'),
};

// Generated or local-only folders. Root folders and app build output are anchored, so area folders
// such as packages/tooling/src/build/ are still checked.
const IGNORE = ['node_modules', '.git', '.expo', 'ios', 'android', 'apps/*/build/', 'apps/*/dist/', 'apps/*/sfx-preview/', 'coverage/', 'reports/', 'dist-audit/', 'tools/', '.stryker-tmp/', 'skills/', '.claude/', 'expo-env.d.ts'];
const MONOREPO_CODE = /^((apps|packages|test|__mocks__)\/|[^/]+$)/;
const TEST_GLOBS = ['**/*.test.ts', '**/*.test.tsx', 'test/**', 'jest.setup.ts', '__mocks__/**'];
const DEFAULT_EXPORT_OK = ['apps/*/app.config.ts', 'packages/shell/plugins/**', '__mocks__/**'];
const NODE_CODE = ['apps/*/app.config.ts', 'packages/shell/src/config/**', 'packages/shell/plugins/**', 'packages/tooling/**'];
const LIMITS = { fileLines: 250, testFileLines: 400, tsFunction: 40, tsxFunction: 80, params: 3 };

const any = (rel, globs) => globs.some((glob) => matchGlob(rel, glob));

/** Text of a comment without its markers, e.g. "eslint-disable-next-line x". */
function commentBody(text) {
  return text.replace(/^\/\/+|^\/\*+|\*+\/$/g, '').replace(/^[\s*]+/, '').trim();
}

function checkComments(rel, scan, report) {
  for (const comment of scan.comments) {
    const body = commentBody(comment.text);
    const at = { file: rel, line: comment.line };
    if (/^(eslint-disable|eslint-enable|eslint-env|eslint\s|globals?\s|exported\s)/.test(body)) {
      report.problem({ ...at, rule: 'no-inline-config', message: `inline ESLint directive "${body.slice(0, 40)}"`, fix: 'Delete it and fix the code; inline config is switched off, and an exception belongs in eslint.config.mjs as a files-scoped block.' });
    }
    if (/^@ts-(ignore|nocheck)\b/.test(body)) {
      report.problem({ ...at, rule: 'no-ts-ignore', message: `"${body.split(/\s/)[0]}" silences the type checker`, fix: 'Fix the type error; only a wrong third-party type may use @ts-expect-error with a reason.' });
    }
    const expect = /^@ts-expect-error\b[\s:-]*(.*)$/.exec(body);
    if (expect && expect[1].trim().length < 10) {
      report.problem({ ...at, rule: 'ts-expect-error-reason', message: '@ts-expect-error has no description of at least 10 characters', fix: 'Say which third-party type is wrong and why, e.g. "@ts-expect-error: expo-iap types miss revocationDate".' });
    }
    if (/^(todo|fixme|xxx|hack)\b/i.test(body)) {
      report.problem({ ...at, rule: 'no-warning-comment', message: `"${body.slice(0, 30)}" comment`, fix: 'Do the work now or leave it out; nothing comes back to TODO comments and git keeps history.' });
    }
  }
}

function checkSizes(rel, scan, text, isTest, report) {
  const lines = codeLineCount(scan.codeKeep);
  const fileLimit = isTest ? LIMITS.testFileLines : LIMITS.fileLines;
  if (lines > fileLimit) {
    report.problem({ file: rel, line: 1, rule: 'max-lines', message: `${lines} code lines; the limit is ${fileLimit}`, fix: 'Split by responsibility (rules vs scoring vs generation), never into part-1/part-2 files; move large static data to .json.' });
  }
  if (!isTest) {
    const limit = rel.endsWith('.tsx') ? LIMITS.tsxFunction : LIMITS.tsFunction;
    for (const fn of functionsOf(scan)) {
      if (fn.bodyEnd === -1) continue;
      const count = codeLineCount(scan.codeKeep, text.lastIndexOf('\n', fn.index) + 1, fn.bodyEnd + 1);
      if (count > limit) {
        report.problem({ file: rel, line: fn.line, rule: 'max-lines-per-function', message: `function ${fn.name} has ${count} code lines; the limit is ${limit}`, fix: 'Extract named steps into pure functions or a sub-component; never join lines to fit.' });
      }
    }
  }
  for (const list of paramListsOf(scan)) {
    if (list.params > LIMITS.params) {
      report.problem({ file: rel, line: list.line, rule: 'max-params', message: `${list.name} takes ${list.params} parameters; the limit is ${LIMITS.params}`, fix: 'Pass one readonly options object type named <Function>Options.' });
    }
  }
}

function checkSyntax(rel, scan, isDts, isTest, report) {
  const { code, lineOf } = scan;
  const hit = (regex, rule, message, fix) => {
    for (const match of code.matchAll(regex)) report.problem({ file: rel, line: lineOf(match.index + match[0].search(/\S/)), rule, message, fix });
  };
  hit(/(?<![\w$.])(?:export\s+)?(?:declare\s+)?(?:const\s+)?enum\s+[A-Za-z_$]/g, 'no-enum', 'enum declaration', "Use an `as const` array and a union: const MODES = ['a', 'b'] as const; type Mode = (typeof MODES)[number].");
  if (!isDts) {
    hit(/(?<![\w$.])(?:export\s+)?(?:declare\s+)?(?:namespace|module)\s+[A-Za-z_$][\w$.]*\s*\{/g, 'no-namespace', 'namespace or module block', 'Use plain modules; namespaces are not erasable (only *.d.ts merging may use declare namespace).');
    hit(/(?<![\w$.])(?:export\s+)?(?:declare\s+)?interface\s+[A-Za-z_$]/g, 'no-interface', 'interface declaration', 'Declare it with type; interface is only for declaration merging in *.d.ts files.');
  }
  for (const match of code.matchAll(/\bconstructor\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    const close = code.indexOf(')', open);
    if (/\b(public|private|protected|readonly)\s+[A-Za-z_$]/.test(code.slice(open, close))) {
      report.problem({ file: rel, line: lineOf(match.index), rule: 'no-parameter-property', message: 'constructor parameter property', fix: 'Declare the field and assign it in the constructor body; parameter properties are not erasable.' });
    }
  }
  if (!any(rel, DEFAULT_EXPORT_OK)) {
    hit(/\bexport\s+default\b|\bexport\s*\{[^}]*\bas\s+default\b/g, 'no-default-export', 'default export', 'Export by name (export function x / export const x); only app.config.ts, config plugins and __mocks__ default-export.');
  }
  for (const match of code.matchAll(/(?<![\w$.])any(?![\w$])/g)) {
    const before = code.slice(Math.max(0, match.index - 12), match.index);
    const after = code.slice(match.index + 3, match.index + 6);
    if (/[:<,|&=[]\s*$|\b(as|extends|keyof|readonly)\s+$/.test(before) && !/^\s*[(:]/.test(after)) {
      report.problem({ file: rel, line: lineOf(match.index), rule: 'no-explicit-any', message: 'the any type', fix: 'Use unknown and narrow it, or name the real type.' });
    }
  }
  if (!isTest) hit(/(?<=[\w$)\]])!(?=[.[)\],;:])(?!=)/g, 'no-non-null-assertion', 'non-null assertion "!"', 'Handle undefined explicitly (noUncheckedIndexedAccess makes it visible): if (x === undefined) ... or ?? fallback.');
  hit(/(?<![\w$])on[A-Z][\w$]*=\{\s*async\b|(?<![\w$])(?:const|let)\s+handle[A-Z][\w$]*\s*(?::[^=]+)?=\s*async\b|\basync\s+function\s+handle[A-Z]/g, 'sync-handler', 'async event handler', 'Keep the handler synchronous: const handlePress = (): void => { task().catch(reportError); };');
  hit(/(?:^|[;{}\n])[ \t]*void\s+[\w$.]+(?:\?\.)?[\w$.]*\s*\(/g, 'no-void-promise', 'void used to drop a promise', 'Await it, return it, or end it with .catch(reportError).');
  hit(/\bthrow\s+['"`]/g, 'throw-error-object', 'throw of a string', "Throw an Error: throw new Error('message', { cause }).");
  if (!any(rel, NODE_CODE)) hit(/\bconsole\.(log|info|debug|trace|table|dir)\s*\(/g, 'no-console-log', 'console output in app code', 'Record through ErrorLogPort or show it in the debug menu; only warn and error are allowed.');
}

function checkEmptyCatch(rel, scan, text, report) {
  for (const match of scan.code.matchAll(/\bcatch\s*(\([^)]*\))?\s*\{/g)) {
    const open = match.index + match[0].length - 1;
    const close = scan.code.indexOf('}', open);
    if (close !== -1 && text.slice(open + 1, close).trim() === '') {
      report.problem({ file: rel, line: scan.lineOf(match.index), rule: 'no-empty-catch', message: 'empty catch block', fix: 'Map the error to a Result, record it through ErrorLogPort with a fallback, or rethrow with { cause }.' });
    }
  }
}

function checkImports(rel, scan, packageNames, report) {
  for (const entry of importsOf(scan)) {
    const at = { file: rel, line: entry.line };
    if (entry.spec.startsWith('../')) {
      report.problem({ ...at, rule: 'no-parent-import', message: `import from "${entry.spec}"`, fix: 'Import other folders through the package name: @scope/<package>/<path-under-src>.ts.' });
      continue;
    }
    const isInternal = entry.spec.startsWith('./') || packageNames.some((name) => entry.spec.startsWith(`${name}/`));
    if (isInternal && !/\.(ts|tsx|json)$/.test(entry.spec)) {
      report.problem({ ...at, rule: 'import-extension', message: `"${entry.spec}" has no file extension`, fix: 'Write the extension (./x.ts, @scope/shell/ui/app-text.tsx): Node type stripping and the exports map need it.' });
    }
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const report = createReporter({ name: 'check-source', json: options.json });
  const packageNames = workspacePackageNames(root);
  // Only monorepo code: pre-existing top-level folders (knowledge, design exports, notes) are ignored like ESLint does.
  const files = walk(root, { include: ['*.ts', '*.tsx'], ignore: IGNORE }).filter((rel) => MONOREPO_CODE.test(rel));
  for (const rel of files) {
    const text = readFileSync(join(root, rel), 'utf8');
    const scan = scanSource(text);
    const isTest = any(rel, TEST_GLOBS);
    const isDts = rel.endsWith('.d.ts');
    checkComments(rel, scan, report);
    checkSizes(rel, scan, text, isTest, report);
    checkSyntax(rel, scan, isDts, isTest, report);
    checkEmptyCatch(rel, scan, text, report);
    checkImports(rel, scan, packageNames, report);
  }
  return report.finish({ checked: files.length, unit: 'TypeScript files' });
});
