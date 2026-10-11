// packages/tooling/src/release/release-runner.ts
// Runs one release step with its output in apps/<game>/build/logs/<step>.log. A failure is matched
// against the playbook: an owner stop ends the run with one message; nothing is ever retried here.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  classifyReleaseFailure,
  resumeHint,
  stopMessage,
} from '@e07/tooling/release/release-failures.ts';

export type ReleaseContext = {
  readonly game: string;
  readonly appDir: string;
  readonly env: NodeJS.ProcessEnv;
};

export type StepCommand = {
  readonly file: string;
  readonly args: readonly string[];
  /** Run from the repo root instead of apps/<game>. */
  readonly atRoot?: boolean;
};

function lastErrorLine(output: string): string {
  const lines = output.trimEnd().split('\n');
  return lines.findLast((line) => /error|fail|denied|ITMS-/i.test(line)) ?? lines.at(-1) ?? '';
}

/** Runs the command, logs it, and returns its output; throws a ready-to-send message on failure. */
export function runReleaseStep(
  name: string,
  command: StepCommand,
  context: ReleaseContext,
): string {
  const logDir = join(context.appDir, 'build', 'logs');
  mkdirSync(logDir, { recursive: true });
  console.log(`release:ios: ${name} ...`);
  const result = spawnSync(command.file, command.args, {
    cwd: command.atRoot === true ? '.' : context.appDir,
    env: context.env,
    encoding: 'utf8',
    maxBuffer: 512 << 20,
  });
  const output = `${result.stdout}${result.stderr}`;
  const logFile = join(logDir, `${name}.log`);
  writeFileSync(logFile, output);
  if (result.status === 0) {
    return result.stdout;
  }
  throw new Error(failureMessage(name, output, logFile));
}

export function failureMessage(step: string, output: string, logFile: string): string {
  const verdict = classifyReleaseFailure(output);
  const resume = resumeHint(step);
  if (verdict === null) {
    return `step "${step}" failed with an unknown error: ${lastErrorLine(output)}\nRead ${logFile} and diagnose; do not retry blindly.\n${resume}`;
  }
  const errorLine = verdict.line === '' ? lastErrorLine(output) : verdict.line;
  if (verdict.isStop) {
    return `${stopMessage(step, errorLine, verdict)}\n(log: ${logFile})\n${resume}`;
  }
  return `step "${step}" failed (${verdict.id}): ${errorLine}\nFix: ${verdict.action}\n(log: ${logFile})\n${resume}`;
}

/** Synchronous wait between polls (the CLI has nothing else to do meanwhile). */
export function sleepSeconds(seconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}
