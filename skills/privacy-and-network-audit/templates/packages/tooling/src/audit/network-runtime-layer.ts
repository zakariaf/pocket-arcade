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

// `pgrep` prints one pid per line.
export function pidsOf(pgrepOutput: string): string[] {
  return pgrepOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line));
}

/**
 * The `pgrep -f` pattern (an extended regular expression over the whole command line) of the
 * app's process: any bundle folder whose executable is appName, then its launch arguments or the
 * end. Any folder, because Maestro's clearState reinstalls the app as
 * <bundle id>-<timestamp>.app/<App>, where '<App>.app/<App>' finds nothing (seen 2026-09-30: the
 * sampler and the memory step saw no process after the first flow). With a udid: that
 * simulator's copy only.
 */
export function appProcessPattern(appName: string, udid?: string): string {
  const executable = appName.replace(/[.[\]()*+?{}|^$\\]/g, (char) => `\\${char}`);
  const device = udid === undefined ? '' : `Devices/${udid}/.*`;
  return `${device}\\.app/${executable}( |$)`;
}

// The simulator app is a macOS process: find it by its bundle path. Every running copy counts
// (the phone and the iPad simulator can both run it), so none of them escapes the sampler.
export function appPids(appName: string): string[] {
  try {
    return pidsOf(execFileSync('pgrep', ['-f', appProcessPattern(appName)], { encoding: 'utf8' }));
  } catch {
    return []; // not running
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
