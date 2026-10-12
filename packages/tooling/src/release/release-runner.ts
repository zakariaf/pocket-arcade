// packages/tooling/src/release/release-runner.ts
// Runs one release step with its output in apps/<game>/build/logs/<step>.log. A failure is matched
// against the playbook: an owner stop ends the run with one message; nothing is ever retried here.
import { runToolStep } from '@e07/tooling/ios/tool-step.ts';
import {
  classifyReleaseFailure,
  resumeHint,
  stopMessage,
} from '@e07/tooling/release/release-failures.ts';

import type { StepCommand } from '@e07/tooling/ios/tool-step.ts';

export type ReleaseContext = {
  readonly game: string;
  readonly appDir: string;
  readonly env: NodeJS.ProcessEnv;
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
  console.log(`release:ios: ${name} ...`);
  const result = runToolStep(name, command, context);
  if (result.status === 0) {
    return result.stdout;
  }
  throw new Error(failureMessage(name, result.output, result.logFile));
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
