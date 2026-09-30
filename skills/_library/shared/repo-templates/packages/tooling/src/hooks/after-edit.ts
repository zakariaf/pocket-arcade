// packages/tooling/src/hooks/after-edit.ts
// device-only: covered by the Claude Code PostToolUse hook, which runs it after every edit
// Claude Code PostToolUse hook (Edit|Write): formats and lints the one file just edited.
// Exit 2 + stderr is the only way the agent sees the problems (Claude Code hooks: exit code 2).
// The repo root is found from this file's own place (packages/tooling/src/hooks/), so the hook works
// from any working directory inside the repo.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PRETTIER_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|json|md|ya?ml)$/u;
const ESLINT_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs)$/u;
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');

type HookInput = { readonly tool_input?: { readonly file_path?: string } };

function run(command: string, args: readonly string[]): { ok: boolean; output: string } {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

function editedFile(): string | null {
  const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
  const filePath = input.tool_input?.file_path;
  if (filePath === undefined) {
    return null;
  }
  const relative = path.relative(process.cwd(), filePath);
  return relative.startsWith('..') ? null : relative;
}

function main(): number {
  process.chdir(REPO_ROOT);
  const file = editedFile();
  if (file === null || !PRETTIER_EXTENSIONS.test(file)) {
    return 0;
  }
  const format = run('npx', [
    'prettier',
    '--write',
    '--ignore-unknown',
    '--log-level',
    'warn',
    file,
  ]);
  const lint = ESLINT_EXTENSIONS.test(file)
    ? run('npx', ['eslint', '--fix', '--max-warnings', '0', '--no-warn-ignored', file])
    : { ok: true, output: '' };
  if (format.ok && lint.ok) {
    return 0;
  }
  console.error(`after-edit: fix these problems in ${file}\n${format.output}${lint.output}`);
  return 2;
}

process.exitCode = main();
