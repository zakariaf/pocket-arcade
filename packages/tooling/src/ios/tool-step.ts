// packages/tooling/src/ios/tool-step.ts
// The one way build:ios:sim, build:android:emu, release:ios and release:android run a step: the
// command from apps/<game> (or the repo root), its whole output in apps/<game>/build/logs/<step>.log,
// and the result for the caller to judge (the builds throw with the log's tail, runStepOrThrow; the
// iOS release matches its failure playbook). Also the one synchronous wait between polls: these
// CLIs have nothing else to do meanwhile.
import { spawnSync } from 'node:child_process';
import { closeSync, fstatSync, mkdirSync, openSync, readSync, rmSync, writeSync } from 'node:fs';
import { join } from 'node:path';

/** What a caller reads back of a step: all of a short output, the last MiB of a long one. */
export const STEP_TAIL_BYTES = 1 << 20;
const COPY_CHUNK_BYTES = 1 << 16;

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
  /** The step's stdout (its last STEP_TAIL_BYTES when longer). */
  readonly stdout: string;
  /** stdout then stderr, as written to the log (its last STEP_TAIL_BYTES when longer). */
  readonly output: string;
  readonly logFile: string;
};

/** The text of bytes [start, end) of an open file. */
function readRange(fd: number, start: number, end: number): string {
  const buffer = Buffer.alloc(end - start);
  readSync(fd, buffer, 0, buffer.length, start);
  return buffer.toString('utf8');
}

/** The last STEP_TAIL_BYTES before `end`; a cut tail starts at its first whole line. */
function tailBefore(fd: number, end: number): string {
  const start = Math.max(0, end - STEP_TAIL_BYTES);
  const text = readRange(fd, start, end);
  return start === 0 ? text : text.slice(text.indexOf('\n') + 1);
}

/** Appends a file's bytes to an open file, a chunk at a time. */
function appendFileTo(target: number, file: string): void {
  const source = openSync(file, 'r');
  const chunk = Buffer.alloc(COPY_CHUNK_BYTES);
  try {
    for (let read = readSync(source, chunk); read > 0; read = readSync(source, chunk)) {
      writeSync(target, chunk, 0, read);
    }
  } finally {
    closeSync(source);
  }
}

/** Why a step has no exit status: it never started, or a signal stopped it. */
function whyNoStatus(file: string, error: Error | undefined, signal: string | null): string {
  if (error !== undefined) return `${file} did not start: ${error.message}\n`;
  return signal === null ? '' : `${file} was stopped by ${signal}\n`;
}

/**
 * Runs one step with stdout written straight into its log while it runs (a long archive can be
 * followed there) and stderr after it, so no output is ever held in a pipe or capped in memory.
 */
export function runToolStep(name: string, command: StepCommand, context: StepContext): StepResult {
  const logDir = join(context.appDir, 'build', 'logs');
  mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, `${name}.log`);
  const stderrFile = `${logFile}.stderr`;
  const log = openSync(logFile, 'w+');
  const stderr = openSync(stderrFile, 'w');
  try {
    const result = spawnSync(command.file, command.args, {
      cwd: command.atRoot === true ? '.' : context.appDir,
      env: context.env,
      stdio: ['ignore', log, stderr],
    });
    const stdoutEnd = fstatSync(log).size;
    closeSync(stderr);
    appendFileTo(log, stderrFile);
    writeSync(log, whyNoStatus(command.file, result.error, result.signal));
    const output = tailBefore(log, fstatSync(log).size);
    return { status: result.status, stdout: tailBefore(log, stdoutEnd), output, logFile };
  } finally {
    closeSync(log);
    rmSync(stderrFile, { force: true });
  }
}

/** The last `count` lines of a step's output (what a failure message shows). */
export function tailOf(output: string, count: number): string {
  return output.trimEnd().split('\n').slice(-count).join('\n');
}

/** Blocks for `ms` milliseconds. */
export function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Runs one step of a CLI; throws with the step's log and the last 30 lines of its output. */
export function runStepOrThrow(
  cli: string,
  step: StepCommand & { readonly name: string },
  context: StepContext,
): void {
  const { name, ...command } = step;
  console.log(`${cli}: ${name} ...`);
  const result = runToolStep(name, command, context);
  if (result.status !== 0) {
    throw new Error(
      `step "${name}" failed (exit ${String(result.status)}), see ${result.logFile}:\n${tailOf(result.output, 30)}`,
    );
  }
}
