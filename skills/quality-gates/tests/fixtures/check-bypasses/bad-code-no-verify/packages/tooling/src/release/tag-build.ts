// packages/tooling/src/release/tag-build.ts
import { execFileSync } from 'node:child_process';

export function commitBuild(message: string): void {
  execFileSync('git', ['commit', '--no-verify', '-m', message]);
}
