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

/** execFileSync with text output; a test passes its own. */
export type ExecText = (command: string, args: readonly string[]) => string;
const execText: ExecText = (command, args) =>
  execFileSync(command, [...args], { encoding: 'utf8' });

/** pgrep and lsof exit 1 for "nothing found"; any other failure is the sampler's own error. */
function nothingFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'status') === 1;
}

// The simulator app is a macOS process: find it by its bundle path on each of this run's
// simulators. Every copy there counts (the phone and the iPad can both run it). A pgrep that fails
// for another reason throws: a sampler that cannot look would otherwise report "no socket".
export function appPids(
  appName: string,
  udids: readonly string[],
  exec: ExecText = execText,
): string[] {
  const pids = new Set<string>();
  for (const pattern of appProcessPatterns(appName, udids)) {
    try {
      for (const pid of pidsOf(exec('pgrep', ['-f', pattern]))) pids.add(pid);
    } catch (error: unknown) {
      if (!nothingFound(error)) throw error; // exit 1: the app is not running there
    }
  }
  return [...pids];
}

/** The app's non-loopback sockets; lsof's exit 1 (no socket, or the process ended) is none. */
export function sampleSockets(pid: string, exec: ExecText = execText): string[] {
  try {
    return nonLoopbackConnections(exec('lsof', ['-nP', '-i', '-a', '-p', pid]));
  } catch (error: unknown) {
    if (nothingFound(error)) return [];
    throw error;
  }
}

/**
 * What a sampler writes after every sample (sample-sockets.ts), next to the run's report: the
 * positive sign that it ran. An empty network.txt is N3 evidence only when each sampler of the run
 * kept sampling until the end, found the app, and reported no error (samplerProblems).
 */
export type SamplerStatus = {
  readonly samples: number;
  /** Samples that found the app running on the sampler's simulators. */
  readonly appSamples: number;
  readonly errorCount: number;
  /** The first MAX_KEPT_ERRORS messages. */
  readonly errors: readonly string[];
};

const MAX_KEPT_ERRORS = 5;
/** How long the runner waits between its two reads of a status at the end (a sample a second). */
export const SAMPLER_PROOF_WAIT_MS = 3000;

export const NEW_SAMPLER_STATUS: SamplerStatus = {
  samples: 0,
  appSamples: 0,
  errorCount: 0,
  errors: [],
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The status after one sample: how many pids it found, and its error (null: none). */
export function nextSamplerStatus(
  status: SamplerStatus,
  sample: { readonly pids: number; readonly error: unknown },
): SamplerStatus {
  const hasFailed = sample.error !== null;
  return {
    samples: status.samples + 1,
    appSamples: status.appSamples + (sample.pids > 0 ? 1 : 0),
    errorCount: status.errorCount + (hasFailed ? 1 : 0),
    errors:
      hasFailed && status.errors.length < MAX_KEPT_ERRORS
        ? [...status.errors, messageOf(sample.error)]
        : status.errors,
  };
}

/** <report>.sampler-<udid>[+<udid>].json */
export function samplerStatusPath(report: string, udids: readonly string[]): string {
  return `${report}.sampler-${udids.join('+')}.json`;
}

export function samplerStatusText(status: SamplerStatus): string {
  return `${JSON.stringify(status, null, 2)}\n`;
}

/**
 * One sampler at the end of the run: its status file read twice, SAMPLER_PROOF_WAIT_MS apart (no
 * wall clock: a live sampler's count grows in between), and how it exited before the end.
 */
export type SamplerEnd = {
  readonly udid: string;
  /** null: no status file. */
  readonly statusText: string | null;
  readonly laterStatusText: string | null;
  /** null: still running when the runner stopped it; else how it ended ('exit code 1'). */
  readonly exit: string | null;
};

function statusOf(text: string | null): SamplerStatus | null {
  if (text === null) return null;
  try {
    const value = JSON.parse(text) as unknown;
    const status = value as Partial<SamplerStatus> | null;
    return typeof status?.samples === 'number' &&
      typeof status.appSamples === 'number' &&
      typeof status.errorCount === 'number' &&
      Array.isArray(status.errors)
      ? (value as SamplerStatus)
      : null;
  } catch {
    return null;
  }
}

/** A sampler that took samples: its errors, a halt before the end, an app it never found. */
function sampleProblems(who: string, status: SamplerStatus, end: SamplerEnd): string[] {
  const problems: string[] = [];
  if (status.errorCount > 0) {
    problems.push(
      `${who} failed ${String(status.errorCount)} time(s), first: ${status.errors[0] ?? 'no message'}`,
    );
  }
  const later = statusOf(end.laterStatusText);
  if (end.exit === null && (later?.samples ?? 0) <= status.samples) {
    problems.push(
      `${who} took no new sample at the end of the run (${String(status.samples)} samples, then none)`,
    );
  }
  if (Math.max(status.appSamples, later?.appSamples ?? 0) === 0) {
    problems.push(`${who} never found the app running there`);
  }
  return problems;
}

/** Why this sampler's empty report would prove nothing; [] when it was alive until the end. */
export function samplerProblems(end: SamplerEnd): string[] {
  const who = `network: the socket sampler on ${end.udid}`;
  if (end.statusText === null) {
    return [`${who} never started (no status file), so an empty network.txt proves nothing`];
  }
  const status = statusOf(end.statusText);
  if (status === null) return [`${who} wrote no readable status`];
  const exited = end.exit === null ? [] : [`${who} stopped before the run ended (${end.exit})`];
  if (status.samples === 0) return [...exited, `${who} took no sample`];
  return [...exited, ...sampleProblems(who, status, end)];
}
