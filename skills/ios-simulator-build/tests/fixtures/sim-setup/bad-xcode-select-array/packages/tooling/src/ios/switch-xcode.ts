import { spawnSync } from 'node:child_process';

export function useXcode27(): void {
  spawnSync('xcode-select', ['--switch', '/Applications/Xcode.app']);
}
