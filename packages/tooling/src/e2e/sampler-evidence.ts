// packages/tooling/src/e2e/sampler-evidence.ts
// The end of an E2E run (run-e2e-ios.ts): an empty network.txt is N3 evidence only from socket
// samplers proven alive until the end. Each sampler (sample-sockets.ts) rewrites its status file
// after every sample; this reads every status twice, `wait` apart (no wall clock: a live sampler's
// count grows in between), then kills the samplers, writes the verdict to network-samplers.json
// next to network.txt (check-e2e-report rule network-sampler) and returns one failure line per
// problem (samplerProblems: never started, exited early, stopped sampling, failed, never found the
// app), so the run fails instead of passing on a sampler that was not watching.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { samplerProblems, samplerStatusPath } from '@e07/tooling/audit/network-runtime-layer.ts';

import type { SamplerStatus } from '@e07/tooling/audit/network-runtime-layer.ts';

/** The part of a spawned sampler process this needs (a ChildProcess). */
type SamplerProcess = {
  on(
    event: 'exit',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  kill(): boolean;
};

export type RunningSampler = {
  readonly udid: string;
  /** How it ended before the runner stopped it ('exit code 1'), or null while it runs. */
  readonly exit: () => string | null;
  readonly kill: () => void;
};

/** One entry of network-samplers.json. */
export type SamplerEvidence = {
  readonly udid: string;
  readonly samples: number;
  readonly appSamples: number;
  readonly problems: readonly string[];
};

/** A spawned sampler with how it ended, if it ended before the runner stopped it. */
export function trackSampler(udid: string, child: SamplerProcess): RunningSampler {
  let exit: string | null = null;
  child.on('exit', (code, signal) => {
    exit ??= signal === null ? `exit code ${String(code)}` : `signal ${signal}`;
  });
  child.on('error', (error) => {
    exit ??= `could not start: ${error.message}`;
  });
  return {
    udid,
    exit: () => exit,
    kill: () => {
      child.kill();
    },
  };
}

const readText = (file: string): string | null =>
  existsSync(file) ? readFileSync(file, 'utf8') : null;

function countsOf(text: string | null): Pick<SamplerStatus, 'samples' | 'appSamples'> {
  try {
    const status = JSON.parse(text ?? '') as Partial<SamplerStatus> | null;
    return { samples: status?.samples ?? 0, appSamples: status?.appSamples ?? 0 };
  } catch {
    return { samples: 0, appSamples: 0 };
  }
}

export async function proveSamplersAlive(
  samplers: readonly RunningSampler[],
  network: string,
  wait: () => Promise<void>,
): Promise<string[]> {
  const statusFile = (udid: string): string => samplerStatusPath(network, [udid]);
  const first = samplers.map(({ udid }) => readText(statusFile(udid)));
  await wait();
  const evidence: SamplerEvidence[] = samplers.map((sampler, index) => {
    const laterStatusText = readText(statusFile(sampler.udid));
    const end = { udid: sampler.udid, exit: sampler.exit(), laterStatusText };
    const problems = samplerProblems({ ...end, statusText: first[index] ?? null });
    return { udid: sampler.udid, ...countsOf(laterStatusText), problems };
  });
  for (const sampler of samplers) sampler.kill();
  const file = join(dirname(network), 'network-samplers.json');
  writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
  if (evidence.length === 0) return [`network: no socket sampler ran, see ${file}`];
  return evidence.flatMap(({ problems }) => problems);
}
