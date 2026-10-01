// packages/tooling/src/audit/network-runtime-layer.ts
// Layer F: sample the app's sockets while an E2E flow runs (Release, test variant, ADS_MODE=off).
// StoreKit traffic runs in system daemons and is invisible here (allowed anyway, spec N3 (b)).
import { execFileSync } from 'node:child_process';

const LOOPBACK = /^(127\.|\[::1\]|localhost)/;

// `lsof -nP -i -a -p <pid>` prints one line per socket; "->" marks a connected peer.
export function nonLoopbackConnections(lsofOutput: string): string[] {
  return lsofOutput
    .split('\n')
    .filter((line) => line.includes('->'))
    .filter((line) => {
      const peer = line.split('->')[1]?.trim().split(/\s/)[0] ?? '';
      return !LOOPBACK.test(peer);
    });
}

// The simulator app is a macOS process: find it by its bundle path.
export function appPid(appName: string): string | null {
  try {
    const out = execFileSync('pgrep', ['-f', `${appName}.app/${appName}`], { encoding: 'utf8' });
    return out.trim().split('\n')[0] ?? null;
  } catch {
    return null; // not running
  }
}

export function sampleSockets(pid: string): string[] {
  try {
    const out = execFileSync('lsof', ['-nP', '-i', '-a', '-p', pid], { encoding: 'utf8' });
    return nonLoopbackConnections(out);
  } catch {
    return []; // lsof exits 1 when the process has no sockets
  }
}
