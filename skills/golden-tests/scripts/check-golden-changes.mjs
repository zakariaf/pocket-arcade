#!/usr/bin/env node
// check-golden-changes.mjs: reads commits (or the staged change) and fails when a golden, baseline or
// pixel matcher changed without a Gate-Change trailer, when an existing daily-challenge golden was
// edited or deleted (never allowed), or when a pixel tolerance was raised without the owner's approval.
// Paths under the in-repo skills/ library, .claude/ and generated output (REPO_SCAN_IGNORES) are
// never goldens: a skill's fixtures hold golden-shaped files that are not the app's.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-golden-changes.mjs . --range <base>..HEAD

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { createReporter, fail, isRepoScanIgnored, matchGlob, parseArgs, requireDir, requireFile, run } from './check-lib.mjs';

const SPEC = {
  name: 'check-golden-changes',
  summary: 'Checks history (or the staged change) for the golden policy: Gate-Change trailers on every golden change, daily goldens never edited or deleted, tolerances never raised without the owner.',
  usage: '[repo-root] (--range <revs> | --log <file> | --staged) [options]',
  options: {
    range: { type: 'string', value: 'revs', help: 'Commits to check, for example main..HEAD or HEAD~5..HEAD (runs git log)' },
    log: { type: 'string', value: 'file', help: 'A log captured earlier with the command below' },
    staged: { type: 'boolean', help: 'Check the staged change (git diff --cached) as one commit' },
    message: { type: 'string', value: 'file', help: 'With --staged: the planned commit message (for its trailers)' },
    repo: { type: 'string', value: 'dir', help: 'Same as the positional repo root (the git repository)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'The repo root is the optional positional argument (default ".").',
    '',
    'Rules:',
    '  gate-change-missing   a commit adds, changes or deletes a golden path without "Gate-Change: <reason>" (10+ chars)',
    '  daily-golden-changed  a commit edits or deletes an existing snapshot entry whose key contains "daily"',
    '                        (adding a new daily date is fine); never allowed, even with a trailer',
    '  tolerance-raised      failureThreshold, MAX_DIFF_RATIO or maxDiffRatio went up without a Gate-Change',
    '                        trailer that names the owner\'s approval',
    '',
    'Golden paths: **/*.golden.test.ts.snap.ios, **/*.golden.test.ts.snap, **/__image_snapshots__/**',
    '(not __diff_output__), apps/*/e2e/baselines/**, test/goldens/boards/skia-golden.ts, **/fixtures/save-v*.json.',
    'Never under skills/, .claude/, node_modules, Pods or an app\'s generated ios/, android/, build/, out/ (check-lib',
    'REPO_SCAN_IGNORES): the skill library\'s fixtures hold golden-shaped files that are not the app\'s goldens.',
    '',
    'Capture a log for --log (the same format --range reads; -U200 keeps the exports[ line of each changed snapshot entry in the diff):',
    "  git log --reverse -M -U200 -p --no-color --format='==> commit %H%n%B%n==> diff' <revs> > history.log",
    'Git-generated commits (Merge, Revert ", fixup!, squash!, amend!) are skipped.',
  ].join('\n'),
};

const FORMAT = '==> commit %H%n%B%n==> diff';
const GOLDEN = ['**/*.golden.test.ts.snap.ios', '**/*.golden.test.ts.snap', '**/__image_snapshots__/**', 'apps/*/e2e/baselines/**', 'test/goldens/boards/skia-golden.ts', '**/fixtures/save-v*.json'];
const GIT_GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/;
const TOLERANCE = /\b(failureThreshold|MAX_DIFF_RATIO|maxDiffRatio)\b\s*[:=]\s*([0-9]*\.?[0-9]+(?:e-?\d+)?)/;

function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.error || result.status !== 0) fail(`git ${args.join(' ')} failed: ${(result.stderr || result.error?.message || '').trim()}`, 'Run inside a git repository and pass a valid revision range.');
  return result.stdout;
}

const isGolden = (path) => !path.includes('__diff_output__') && !isRepoScanIgnored(path) && GOLDEN.some((glob) => matchGlob(path, glob));

/** Split `git diff` / `git log -p` text into files with their removed and added lines. */
function parseDiff(lines) {
  const files = [];
  let file = null;
  let oldLine = 0;
  let entry = null;
  for (const line of lines) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (header) {
      file = { oldPath: header[1], path: header[2], status: 'modified', removed: [], added: [] };
      files.push(file);
      entry = null;
      continue;
    }
    if (!file) continue;
    if (line.startsWith('new file mode')) file.status = 'added';
    else if (line.startsWith('deleted file mode')) file.status = 'deleted';
    else if (line.startsWith('rename to ')) file.status = 'renamed';
    else if (line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('index ') || line.startsWith('Binary files')) continue;
    else if (line.startsWith('@@')) {
      const hunk = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@ ?(.*)$/.exec(line);
      oldLine = hunk ? Number(hunk[1]) : 0;
      const context = hunk?.[2] ?? '';
      entry = /^exports\[`/.test(context) ? context : null;
    } else if (line.startsWith('-')) {
      if (line.startsWith('-exports[`')) entry = line.slice(1);
      file.removed.push({ text: line.slice(1), line: oldLine, entry });
      oldLine += 1;
    } else if (line.startsWith('+')) {
      file.added.push({ text: line.slice(1) });
    } else if (line.startsWith(' ')) {
      if (line.startsWith(' exports[`')) entry = line.slice(1);
      oldLine += 1;
    }
  }
  return files;
}

function parseLog(text) {
  const commits = [];
  let current = null;
  let mode = 'message';
  for (const line of text.split('\n')) {
    const start = /^==> commit ([0-9a-f]{7,40})$/.exec(line);
    if (start) {
      current = { sha: start[1], message: [], diff: [] };
      commits.push(current);
      mode = 'message';
      continue;
    }
    if (!current) continue;
    if (line === '==> diff') {
      mode = 'diff';
      continue;
    }
    current[mode].push(line);
  }
  return commits.map((commit) => ({ sha: commit.sha, message: commit.message.join('\n').trim(), files: parseDiff(commit.diff) }));
}

function trailer(message) {
  return /^Gate-Change:[ \t]*(.*)$/m.exec(message)?.[1]?.trim() ?? '';
}

function toleranceChanges(file) {
  const before = file.removed.map((item) => TOLERANCE.exec(item.text)).filter(Boolean);
  const after = file.added.map((item) => TOLERANCE.exec(item.text)).filter(Boolean);
  const raised = [];
  for (const next of after) {
    const previous = before.find((match) => match[1] === next[1]);
    if (previous && Number(next[2]) > Number(previous[2])) raised.push({ name: next[1], from: previous[2], to: next[2] });
  }
  return raised;
}

function checkCommit(commit, report) {
  const short = commit.sha.slice(0, 8);
  const subject = commit.message.split('\n')[0] ?? '';
  if (GIT_GENERATED.test(subject)) return;
  const reason = trailer(commit.message);
  const golden = commit.files.filter((file) => isGolden(file.path) || isGolden(file.oldPath));
  if (golden.length > 0 && reason.length < 10) {
    const list = golden.slice(0, 3).map((file) => `${file.path} (${file.status})`).join(', ');
    report.problem({ file: golden[0].path, line: 0, rule: 'gate-change-missing', message: `commit ${short} "${subject.slice(0, 50)}" changes ${golden.length} golden file(s) without a Gate-Change trailer: ${list}`, fix: 'Amend the message with "Gate-Change: <which goldens and why, what you looked at>"; if the change was not intended, restore the goldens and fix the code.' });
  }
  for (const file of commit.files.filter((item) => /\.snap(\.(ios|android))?$/.test(item.path))) {
    const daily = new Map();
    for (const item of file.removed) {
      if (item.entry && /daily/i.test(item.entry) && !daily.has(item.entry)) daily.set(item.entry, item.line);
    }
    for (const [entry, line] of daily) {
      const key = /^exports\[`(.*?)`\]/.exec(entry)?.[1] ?? entry;
      report.problem({ file: file.oldPath, line, rule: 'daily-golden-changed', message: `commit ${short} ${file.status === 'deleted' ? 'deletes' : 'edits'} the daily golden "${key.slice(0, 140)}"`, fix: 'Revert it: every app version must generate the same daily level for a date (spec 8.3). Keep the generator output identical, or stop and ask the owner about a new salt from a future date.' });
    }
  }
  for (const file of commit.files) {
    for (const change of toleranceChanges(file)) {
      if (!/owner/i.test(reason)) report.problem({ file: file.path, line: 0, rule: 'tolerance-raised', message: `commit ${short} raises ${change.name} from ${change.from} to ${change.to}`, fix: "Restore the tolerance and fix what differs. Only the owner can agree to a new tolerance; then the commit says so: \"Gate-Change: owner approved <value> because <reason>\"." });
    }
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  if (positionals[0] !== undefined && options.repo !== undefined && positionals[0] !== options.repo) fail(`two repo roots given: ${positionals[0]} and --repo ${options.repo}`, 'Pass the repo root once, as the positional argument.');
  const modes = [options.range, options.log, options.staged ? 'staged' : undefined].filter((value) => value !== undefined && value !== false);
  if (modes.length !== 1) fail('pass exactly one of --range <revs>, --log <file> or --staged', 'Example: --range main..HEAD');
  let commits;
  if (options.log) {
    commits = parseLog(readFileSync(requireFile(options.log, 'log file'), 'utf8'));
    if (commits.length === 0) fail(`nothing to check: ${options.log} holds no "==> commit" blocks`, `Capture it with: git log --reverse -M -U200 -p --no-color --format='${FORMAT}' <revs>`);
  } else {
    const repo = requireDir(positionals[0] ?? options.repo ?? '.', 'git repository');
    if (options.range) {
      commits = parseLog(git(repo, ['log', '--reverse', '-M', '-U200', '-p', '--no-color', `--format=${FORMAT}`, options.range]));
      if (commits.length === 0) fail(`nothing to check: ${options.range} holds no commits`, 'Pass a range that contains commits, for example HEAD~3..HEAD.');
    } else {
      const message = options.message ? readFileSync(requireFile(options.message, 'message file'), 'utf8') : '';
      const diff = git(repo, ['diff', '--cached', '-M', '-U200', '--no-color']);
      if (diff.trim() === '') fail('nothing to check: no staged change', 'Stage the change (git add) first.');
      commits = [{ sha: 'staged00', message: message.trim(), files: parseDiff(diff.split('\n')) }];
    }
  }
  const report = createReporter({ name: SPEC.name, json: options.json });
  // Skill fixtures edit daily snapshots and raise tolerances on purpose: never judge those paths.
  const appFiles = (commit) => commit.files.filter((file) => !isRepoScanIgnored(file.path) || !isRepoScanIgnored(file.oldPath));
  for (const commit of commits) checkCommit({ ...commit, files: appFiles(commit) }, report);
  return report.finish({ checked: commits.length, unit: 'commits' });
});
