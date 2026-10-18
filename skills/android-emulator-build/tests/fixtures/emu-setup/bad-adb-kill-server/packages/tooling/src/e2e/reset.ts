// packages/tooling/src/e2e/reset.ts
import { execFileSync } from 'node:child_process';

export function resetAdb(adb: string): void {
  execFileSync(adb, ['kill-server']);
}
