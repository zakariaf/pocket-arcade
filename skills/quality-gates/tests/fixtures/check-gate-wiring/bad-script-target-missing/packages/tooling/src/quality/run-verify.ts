// packages/tooling/src/quality/run-verify.ts
// device-only: covered by npm run verify itself (this file only wires verify-plan.ts to the shell)
// `npm run verify`: every gate except end-to-end and mutation, cheapest first; stops at the first
// failure. The steps and the partial-Shell rules live in verify-plan.ts (tested there).
import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';

import { readShellSlice, type ShellSlice } from './shell-slice.ts';
import { runPlan, verifyPlan, type VerifyStep } from './verify-plan.ts';

const SIM_TESTS = [
  'apps/*/src/**/*.sim.test.ts',
  'packages/*/src/**/*.sim.test.ts',
  'test/**/*.sim.test.ts',
];

function hasSims(): boolean {
  return SIM_TESTS.some((pattern) => globSync(pattern).length > 0);
}

function execute(step: VerifyStep): number {
  const [command = 'false', ...args] = step.command;
  return spawnSync(command, args, { stdio: 'inherit' }).status ?? 1;
}

function sliceOrNull(): ShellSlice | null | Error {
  try {
    return readShellSlice('.');
  } catch (error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

function main(): number {
  const slice = sliceOrNull();
  if (slice instanceof Error) {
    console.error(`verify: ${slice.message}. Fix shell-slice.json or delete it (the full Shell).`);
    return 1;
  }
  const steps = verifyPlan({ slice, hasSims: hasSims() });
  return runPlan(steps, execute, (line) => {
    console.log(line);
  });
}

process.exitCode = main();
