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

/**
 * One pattern per simulator of this run (its phone and its iPad). Other sessions run the same app on
 * their own simulators, an ADS_MODE=test build among them whose Google sockets are legitimate there:
 * a pattern without a udid would count them as ours (seen 2026-10-01: an ads smoke test on another
 * session's simulator filled this run's network.txt). So the sampler always names its simulators.
 */
export function appProcessPatterns(appName: string, udids: readonly string[]): string[] {
  if (udids.length === 0)
    throw new Error('appProcessPatterns needs the udid of every simulator of the run');
  return udids.map((udid) => appProcessPattern(appName, udid));
}

// The simulator app is a macOS process: find it by its bundle path on each of this run's
// simulators. Every copy there counts (the phone and the iPad can both run it).
export function appPids(appName: string, udids: readonly string[]): string[] {
  const pids = new Set<string>();
  for (const pattern of appProcessPatterns(appName, udids)) {
    try {
      for (const pid of pidsOf(execFileSync('pgrep', ['-f', pattern], { encoding: 'utf8' }))) {
        pids.add(pid);
      }
    } catch {
      // pgrep exits 1 when nothing matches: the app is not running there
    }
  }
  return [...pids];
}

export function sampleSockets(pid: string): string[] {
  try {
    const out = execFileSync('lsof', ['-nP', '-i', '-a', '-p', pid], { encoding: 'utf8' });
    return nonLoopbackConnections(out);
  } catch {
    return []; // lsof exits 1 when the process has no sockets
  }
}
