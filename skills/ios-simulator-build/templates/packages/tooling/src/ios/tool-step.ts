// packages/tooling/src/ios/tool-step.ts
// The one way build:ios:sim and release:ios run a step: the command from apps/<game> (or the repo
// root), its whole output in apps/<game>/build/logs/<step>.log, and the result for the caller to
// judge (the build throws with the log's tail, the release matches its failure playbook). Also the
// one synchronous wait between polls: these CLIs have nothing else to do meanwhile.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type StepCommand = {
  readonly file: string;
  readonly args: readonly string[];
  /** Run from the repo root instead of apps/<game>. */
  readonly atRoot?: boolean;
};

export type StepContext = { readonly appDir: string; readonly env: NodeJS.ProcessEnv };

export type StepResult = {
  /** The exit status; null when the command could not start or was killed. */
  readonly status: number | null;
  readonly stdout: string;
  /** stdout then stderr, as written to the log. */
  readonly output: string;
  readonly logFile: string;
};

export function runToolStep(name: string, command: StepCommand, context: StepContext): StepResult {
  const logDir = join(context.appDir, 'build', 'logs');
  mkdirSync(logDir, { recursive: true });
  const result = spawnSync(command.file, command.args, {
    cwd: command.atRoot === true ? '.' : context.appDir,
    env: context.env,
    encoding: 'utf8',
    maxBuffer: 512 << 20,
  });
  const output = `${result.stdout}${result.stderr}`;
  const logFile = join(logDir, `${name}.log`);
  writeFileSync(logFile, output);
  return { status: result.status, stdout: result.stdout, output, logFile };
}

/** The last `count` lines of a step's output (what a failure message shows). */
export function tailOf(output: string, count: number): string {
  return output.trimEnd().split('\n').slice(-count).join('\n');
}

/** Blocks for `ms` milliseconds. */
export function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
