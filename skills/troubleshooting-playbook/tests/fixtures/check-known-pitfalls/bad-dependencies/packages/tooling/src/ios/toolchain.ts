// packages/tooling/src/ios/toolchain.ts (excerpt)
import { spawnSync } from 'node:child_process';

/** Never xcode-select: the Xcode is chosen per process through DEVELOPER_DIR. */
export function xcodeVersion(developerDir: string): string {
  const out = spawnSync('xcodebuild', ['-version'], { env: { ...process.env, DEVELOPER_DIR: developerDir }, encoding: 'utf8' });
  return out.stdout;
}

export function deleteOwnSimulator(udid: string): void {
  spawnSync('xcrun', ['simctl', 'delete', udid]);
}
