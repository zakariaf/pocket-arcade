// packages/tooling/src/e2e/shot.ts
import { execSync } from 'node:child_process';

export function shot(out: string): void {
  execSync(`adb exec-out screencap -p > ${out}`);
}
