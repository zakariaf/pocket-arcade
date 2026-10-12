// packages/tooling/src/storekit/metro-session.ts
// The StoreKit harness's Metro: its output goes to a log file (a pipe nobody reads fills up and
// blocks Metro mid-run), and it is stopped however the scenarios end (a failed arm or flow must not
// leave it running on its port).
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';

import type { SpawnOptions } from 'node:child_process';

export type SpawnMetro = (
  command: string,
  args: readonly string[],
  options: SpawnOptions & { readonly stdio: readonly ['ignore', number, number] },
) => { readonly kill: () => boolean };

export type MetroInput = {
  readonly appDir: string;
  readonly port: number;
  readonly env: NodeJS.ProcessEnv;
  /** apps/<game>/build/logs/storekit-metro.log */
  readonly logFile: string;
};

/** Starts `expo start` on the port with stdout and stderr in logFile; returns the stop call. */
export function spawnMetro(spawn: SpawnMetro, input: MetroInput): () => void {
  mkdirSync(dirname(input.logFile), { recursive: true });
  const log = openSync(input.logFile, 'w');
  try {
    const metro = spawn('npx', ['expo', 'start', '--port', String(input.port)], {
      cwd: input.appDir,
      env: input.env,
      stdio: ['ignore', log, log],
    });
    return () => {
      metro.kill();
    };
  } finally {
    closeSync(log); // the child holds its own copy of the descriptor
  }
}

/** Runs the scenarios with Metro up and stops Metro afterwards, also when they throw. */
export async function withMetro<T>(
  start: () => Promise<() => void>,
  body: () => Promise<T>,
): Promise<T> {
  const stop = await start();
  try {
    return await body();
  } finally {
    stop();
  }
}
