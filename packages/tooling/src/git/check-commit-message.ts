// packages/tooling/src/git/check-commit-message.ts
// device-only: covered by the lefthook commit-msg hook, which runs it on every commit
// lefthook commit-msg hook: `node packages/tooling/src/git/check-commit-message.ts <msg-file>`.
// It applies the same rules as the git-commits-and-reporting skill's check-commits.mjs
// (commit-message-rules.ts), so a commit that passes here passes there.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

import { checkCommitMessage } from './commit-message-rules.ts';

type QualityGates = { readonly gatedPaths: readonly string[] };

// A commit that stages the skills folder lists thousands of paths; Node's default 1 MB buffer
// made this hook crash with "spawnSync git ENOBUFS" (verified 2026-09-28).
const GIT_OUTPUT_LIMIT_BYTES = 256 * 1024 * 1024;

function stagedFiles(): readonly string[] {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], {
    encoding: 'utf8',
    maxBuffer: GIT_OUTPUT_LIMIT_BYTES,
  });
  return output.split('\0').filter((file) => file.length > 0);
}

function workspaceScopes(): readonly string[] {
  return ['apps', 'packages'].flatMap((root) => (existsSync(root) ? readdirSync(root) : []));
}

function main(messageFile: string | undefined): number {
  if (messageFile === undefined) {
    console.error('usage: check-commit-message.ts <commit-msg-file>');
    return 1;
  }
  const gates = JSON.parse(readFileSync('quality-gates.json', 'utf8')) as QualityGates;
  const problems = checkCommitMessage({
    message: readFileSync(messageFile, 'utf8'),
    files: stagedFiles(),
    gatedPatterns: gates.gatedPaths,
    workspaceScopes: workspaceScopes(),
  });
  for (const problem of problems) {
    console.error(
      `commit-msg: line ${String(problem.line)} [${problem.rule}] ${problem.message} Fix: ${problem.fix}`,
    );
  }
  return problems.length === 0 ? 0 : 1;
}

process.exitCode = main(process.argv[2]);
