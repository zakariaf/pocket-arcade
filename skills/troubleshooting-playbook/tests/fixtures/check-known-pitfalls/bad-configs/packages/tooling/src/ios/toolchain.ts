// packages/tooling/src/ios/toolchain.ts (excerpt)
import { spawnSync } from 'node:child_process';

export function useXcode(path: string): void {
  spawnSync('sudo', ['xcode-select', '-s', path]);
}

export function resetSimulators(): void {
  spawnSync('xcrun', ['simctl', 'shutdown', 'all']);
}
