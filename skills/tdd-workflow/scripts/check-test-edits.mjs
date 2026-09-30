#!/usr/bin/env node
// check-test-edits.mjs: reads commits (or the staged change) and fails when a test was edited to
// pass, a test was deleted, a feat/fix commit changed code without touching a test, or a disabled
// test was added. The TDD evidence lives in history, so this checks history.
// Paths under the in-repo skills/ library, .claude/ and generated output (REPO_SCAN_IGNORES) are
// skipped: skill fixtures plant skipped tests and retries on purpose.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-test-edits.mjs . --range origin/main..HEAD

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { createReporter, fail, isRepoScanIgnored, parseArgs, requireDir, requireFile, run } from './check-lib.mjs';

const SPEC = {
  name: 'check-test-edits',
  summary: 'Checks commits for the TDD rules that only history shows: assertions changed without a Spec-Change trailer, deleted tests, feat/fix code without a test change, and newly disabled tests.',
  usage: '[repo-root] (--range <revs> | --log <file> | --staged) [options]',
  options: {
    range: { type: 'string', value: 'revs', help: 'Commits to check, for example main..HEAD or HEAD~5..HEAD (runs git log)' },
    log: { type: 'string', value: 'file', help: 'A log captured earlier with the command below' },
    staged: { type: 'boolean', help: 'Check the staged change (git diff --cached) as one commit' },
    message: { type: 'string', value: 'file', help: 'With --staged: the planned commit message (for its type and trailers)' },
    repo: { type: 'string', value: 'dir', help: 'Same as the positional repo root (the git repository)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'The repo root is the optional positional argument (default ".").',
    'Files under skills/, .claude/, node_modules, Pods, .expo and each app\'s generated ios/, android/, build/ and',
    'out/ folders are skipped (check-lib REPO_SCAN_IGNORES): the skill library\'s fixtures plant skipped and retried',
    'tests on purpose, and generated code is not ours.',
    '',
    'Rules:',
    '  assertion-changed      an existing test lost or changed an assertion line (expect(, fc.assert() in a commit',
    '                         that also changes production code, or that removes more assertions than it adds,',
    '                         without a "Spec-Change: <section and what changed>" trailer',
    '  test-deleted           a test file was deleted while its unit still exists, without a Spec-Change trailer',
    '  code-without-test      a feat or fix commit changed production code (apps/*/src, packages/*/src) but no test;',
    '                         a thin wrapper whose first 6 lines hold "// device-only: covered by <check>" (the',
    '                         marker check-tests accepts) does not count as production code for this rule',
    '  disabled-test-added    an added line holds .only / .skip / .failing / .todo, xit, xdescribe, fit or jest.retryTimes',
    '',
    'Capture a log for --log (the same format --range reads):',
    "  git log --reverse -M -p --no-color --format='==> commit %H%n%B%n==> diff' <revs> > history.log",
    'Git-generated commits (Merge, Revert ", fixup!, squash!, amend!) are skipped.',
    'The device-only marker is read from the file at that commit (--range: git show <sha>:<path>; --staged: the',
    'index). With --log it is read from the diff, so it counts only when the diff shows the file\'s first lines.',
  ].join('\n'),
};

const FORMAT = '==> commit %H%n%B%n==> diff';
const TEST_FILE = /\.(test|golden\.test|sim\.test)\.(ts|tsx)$/;
const SOURCE_FILE = /^(apps\/[^/]+\/src|packages\/[^/]+\/src)\/.+\.(ts|tsx)$/;
const NOT_SOURCE = /(^|\/)(fixtures|testing|__mocks__)\/|\.d\.ts$/;
const ASSERTION = /\bexpect\s*\(|\bfc\.assert\s*\(|\bexpect\.assertions\s*\(/;
const DISABLED = /\b(?:it|test|describe)\.(?:only|skip|failing|todo)\b|(?<![\w.$])(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(|\bjest\.retryTimes\s*\(/;
const GIT_GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/;
const SPEC_CHANGE = /^Spec-Change:[ \t]*\S/m;
// The same marker check-tests.mjs accepts: in the first 6 lines, naming the check that covers it.
const DEVICE_ONLY = /^\/\/\s*device-only:(.*)$/m;
const HEAD_LINES = 6;

/** True when the first lines carry a reasoned "// device-only: covered by <check>" marker. */
function isDeviceOnly(head) {
  const marker = DEVICE_ONLY.exec(head.split('\n').slice(0, HEAD_LINES).join('\n'));
  return marker !== null && /\bcovered by\s+\S.{8,}/i.test(marker[1]);
}

function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.error || result.status !== 0) fail(`git ${args.join(' ')} failed: ${(result.stderr || result.error?.message || '').trim()}`, 'Run inside a git repository and pass a valid revision range.');
  return result.stdout;
}

/** Split `git diff` / `git log -p` text into files with their added and removed lines. */
function parseDiff(text) {
  const files = [];
  let file = null;
  let oldLine = 0;
  let newLine = 0;
  for (const line of text.split('\n')) {
    const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (header) {
      file = { oldPath: header[1], path: header[2], status: 'modified', added: [], removed: [], head: new Map() };
      files.push(file);
      continue;
    }
    if (!file) continue;
    if (line.startsWith('new file mode')) file.status = 'added';
    else if (line.startsWith('deleted file mode')) file.status = 'deleted';
    else if (line.startsWith('rename from ')) file.status = 'renamed';
    else if (line.startsWith('--- ') || line.startsWith('+++ ')) continue;
    else if (line.startsWith('@@')) {
      const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      oldLine = hunk ? Number(hunk[1]) : 0;
      newLine = hunk ? Number(hunk[2]) : 0;
    } else if (line.startsWith('+')) {
      file.added.push({ text: line.slice(1), line: newLine });
      if (newLine <= HEAD_LINES) file.head.set(newLine, line.slice(1));
      newLine += 1;
    } else if (line.startsWith('-')) {
      file.removed.push({ text: line.slice(1), line: oldLine });
      oldLine += 1;
    } else if (line.startsWith(' ')) {
      if (newLine <= HEAD_LINES) file.head.set(newLine, line.slice(1));
      oldLine += 1;
      newLine += 1;
    }
  }
  return files;
}

function parseLog(text) {
  const commits = [];
  let current = null;
  let inDiff = false;
  const lines = text.split('\n');
  for (const line of lines) {
    const start = /^==> commit ([0-9a-f]{7,40})$/.exec(line);
    if (start) {
      current = { sha: start[1], message: [], diff: [] };
      commits.push(current);
      inDiff = false;
    } else if (current && line === '==> diff') inDiff = true;
    else if (current) (inDiff ? current.diff : current.message).push(line);
  }
  return commits.map((commit) => ({ sha: commit.sha, message: commit.message.join('\n').trim(), files: parseDiff(commit.diff.join('\n')) }));
}

/** The commit without the files every repo scan skips (the skill library, generated output). */
const withoutIgnored = (commit) => ({ ...commit, files: commit.files.filter((file) => !isRepoScanIgnored(file.path) || !isRepoScanIgnored(file.oldPath)) });

const strip = (text) => text.replace(/\s+/g, '');
const isSource = (path) => SOURCE_FILE.test(path) && !TEST_FILE.test(path) && !NOT_SOURCE.test(path);

/** The file's first lines at this commit: from git when a repo is at hand, else what the diff shows. */
function headOf(file, commit, readFile) {
  const text = readFile?.(commit.sha, file.path);
  if (typeof text === 'string') return text;
  const lines = [];
  for (let line = 1; line <= HEAD_LINES && file.head.has(line); line += 1) lines.push(file.head.get(line));
  return lines.join('\n');
}

function checkCommit(report, commit, readFile) {
  const header = commit.message.split('\n')[0] ?? '';
  if (GIT_GENERATED.test(header)) return;
  const sha = commit.sha.slice(0, 7);
  const type = /^([a-z]+)(?:\([^)]*\))?!?:/.exec(header)?.[1] ?? '';
  const hasSpecChange = SPEC_CHANGE.test(commit.message);
  const testFiles = commit.files.filter((file) => TEST_FILE.test(file.path));
  const sourceFiles = commit.files.filter((file) => isSource(file.path) && file.status !== 'deleted');
  const deletedPaths = new Set(commit.files.filter((file) => file.status === 'deleted').map((file) => file.path));
  const addedBlob = testFiles.flatMap((file) => file.added.map((entry) => strip(entry.text))).join('');
  const where = (file, entry) => ({ file: `${sha}:${file.path}`, line: entry?.line ?? 0 });

  for (const file of commit.files.filter((changed) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(changed.path))) {
    for (const entry of file.added) {
      if (DISABLED.test(entry.text)) report.problem({ ...where(file, entry), rule: 'disabled-test-added', message: `adds "${entry.text.trim().slice(0, 70)}"`, fix: 'Finish or delete the test in this slice; never commit skipped, focused or retried tests.' });
    }
  }
  let changedAssertions = [];
  let addedAssertions = 0;
  for (const file of testFiles) {
    addedAssertions += file.added.filter((entry) => ASSERTION.test(entry.text)).length;
    if (file.status === 'added') continue;
    if (file.status === 'deleted') {
      const unitGone = ['.ts', '.tsx'].some((extension) => deletedPaths.has(file.path.replace(TEST_FILE, extension)));
      if (!unitGone && !hasSpecChange) report.problem({ ...where(file), rule: 'test-deleted', message: 'deletes a test file while its unit stays', fix: 'Keep the test; if the spec removed the behaviour, delete the unit too or add "Spec-Change: <section and what changed>".' });
      continue;
    }
    changedAssertions = changedAssertions.concat(file.removed.filter((entry) => ASSERTION.test(entry.text) && !addedBlob.includes(strip(entry.text))).map((entry) => ({ file, entry })));
  }
  if (changedAssertions.length > 0 && !hasSpecChange) {
    const weakens = sourceFiles.length > 0 || addedAssertions < changedAssertions.length || !['test', 'refactor', 'style'].includes(type);
    if (weakens) {
      for (const { file, entry } of changedAssertions) {
        report.problem({ ...where(file, entry), rule: 'assertion-changed', message: `changes the existing assertion "${entry.text.trim().slice(0, 70)}"`, fix: 'Restore the assertion and fix the code. Only a spec change may change an expectation, with a "Spec-Change: <section and what changed>" trailer.' });
      }
    }
  }
  const testedCode = sourceFiles.filter((file) => !isDeviceOnly(headOf(file, commit, readFile)));
  if ((type === 'feat' || type === 'fix') && testedCode.length > 0 && testFiles.filter((file) => file.status !== 'deleted').length === 0) {
    report.problem({ file: `${sha}:${testedCode[0].path}`, line: 0, rule: 'code-without-test', message: `"${header.slice(0, 60)}" changes production code but no test`, fix: 'Commit the failing test and the code together (red and green in one commit). Only a thin wrapper Jest cannot load may skip it, and only with "// device-only: covered by <the check that exercises it>" in its first lines.' });
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  if (positionals[0] !== undefined && options.repo !== undefined && positionals[0] !== options.repo) fail(`two repo roots given: ${positionals[0]} and --repo ${options.repo}`, 'Pass the repo root once, as the positional argument.');
  const modes = [options.range, options.log, options.staged ? 'staged' : undefined].filter(Boolean);
  if (modes.length !== 1) fail('pass exactly one of --range, --log or --staged', 'Run with --help to see the modes.');
  const report = createReporter({ name: 'check-test-edits', json: options.json });
  let commits;
  let readFile = null;
  if (options.log) commits = parseLog(readFileSync(requireFile(options.log, 'log file'), 'utf8'));
  else {
    const repo = requireDir(positionals[0] ?? options.repo ?? '.', 'git repository');
    readFile = (sha, path) => {
      const shown = spawnSync('git', ['-C', repo, 'show', `${sha === 'staged' ? '' : sha}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      return shown.status === 0 ? shown.stdout : null;
    };
    if (options.range) commits = parseLog(git(repo, ['log', '--reverse', '-M', '-p', '--no-color', `--format=${FORMAT}`, options.range]));
    else {
      const message = options.message ? readFileSync(requireFile(options.message, 'message file'), 'utf8') : '';
      const files = parseDiff(git(repo, ['diff', '--cached', '-M', '--no-color']));
      if (files.length === 0) fail('nothing is staged', 'Stage the slice with git add (test and code together), then rerun.');
      commits = [{ sha: 'staged', message: message.trim(), files }];
    }
  }
  if (commits.length === 0) fail('the log or range holds no commits', 'Pass a range that contains the new commits, for example main..HEAD or HEAD~3..HEAD.');
  for (const commit of commits) checkCommit(report, withoutIgnored(commit), readFile);
  return report.finish({ checked: commits.length, unit: 'commits' });
});
