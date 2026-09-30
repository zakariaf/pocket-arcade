// packages/tooling/src/quality/check-commit-message.ts (excerpt)
import { spawnSync } from 'node:child_process';

export function stagedPaths(): string[] {
  const result = spawnSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return result.stdout.split('\n').filter(Boolean);
}
