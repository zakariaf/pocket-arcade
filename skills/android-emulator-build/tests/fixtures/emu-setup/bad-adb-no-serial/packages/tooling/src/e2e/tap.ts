// packages/tooling/src/e2e/tap.ts
import { execFileSync } from 'node:child_process';

export function tap(adb: string, x: number, y: number): void {
  execFileSync(adb, ['shell', 'input', 'tap', String(x), String(y)]);
}
