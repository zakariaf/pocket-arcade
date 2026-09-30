// packages/tooling/src/quality/verify-plan.ts
// The steps of `npm run verify`, cheapest and most likely to fail first, and the one place where a
// partial Shell (shell-slice.json) changes them: knip runs without the export and type issue kinds,
// and test:sim is skipped while no game has a *.sim.test.ts. Everything else stays strict.
import type { ShellSlice } from './shell-slice.ts';

export type VerifyFacts = {
  readonly slice: ShellSlice | null;
  /** True when any *.sim.test.ts exists under apps/*, packages/* or test/. */
  readonly hasSims: boolean;
};

/** Printed as "SKIP <file> [<rule>] <message>"; a skip never counts as a failure. */
export type VerifySkip = { readonly file: string; readonly rule: string; readonly message: string };

export type VerifyStep = {
  readonly name: string;
  readonly command: readonly string[];
  readonly skip: VerifySkip | null;
  /** True when the step does not run at all (its skip says why). */
  readonly isSkipped: boolean;
};

/** knip's export and type issue kinds: the complement of `knip --exports`. */
export const KNIP_EXPORT_KINDS = [
  'exports',
  'nsExports',
  'types',
  'nsTypes',
  'enumMembers',
  'namespaceMembers',
  'duplicates',
] as const;

const npmRun = (script: string): readonly string[] => ['npm', 'run', '-s', script];

function strict(name: string, command: readonly string[]): VerifyStep {
  return { name, command, skip: null, isSkipped: false };
}

function knipStep(slice: ShellSlice | null): VerifyStep {
  if (slice === null) {
    return strict('knip', npmRun('knip'));
  }
  const message =
    `knip runs without the export and type issue kinds while shell-slice.json exists ` +
    `(${slice.why}); files, dependencies, unlisted and binaries are still checked`;
  return {
    name: 'knip',
    command: [...npmRun('knip'), '--', '--exclude', KNIP_EXPORT_KINDS.join(',')],
    skip: { file: 'shell-slice.json', rule: 'knip-exports', message },
    isSkipped: false,
  };
}

function simStep(facts: VerifyFacts): VerifyStep {
  const step = strict('test:sim', npmRun('test:sim'));
  if (facts.slice === null || facts.hasSims) {
    return step;
  }
  const message =
    'no game has a *.sim.test.ts yet and shell-slice.json exists: test:sim has nothing to run';
  return {
    ...step,
    skip: { file: 'jest.sim.config.js', rule: 'test-sim', message },
    isSkipped: true,
  };
}

/** Every verify step in order. Without shell-slice.json every step is strict. */
export function verifyPlan(facts: VerifyFacts): readonly VerifyStep[] {
  return [
    strict('format:check', npmRun('format:check')),
    strict('lint', npmRun('lint')),
    strict('typecheck', npmRun('typecheck')),
    strict('i18n:verify', npmRun('i18n:verify')),
    knipStep(facts.slice),
    strict('guardrail', ['node', 'packages/tooling/src/quality/check-quality-gates.ts']),
    strict('test:coverage', npmRun('test:coverage')),
    strict('audit:network', npmRun('audit:network')),
    strict('audit:licenses', npmRun('audit:licenses')),
    strict('check-deps', ['node', 'packages/tooling/src/deps/check-deps.ts']),
  ];
}

export function formatSkip(skip: VerifySkip): string {
  return `SKIP ${skip.file} [${skip.rule}] ${skip.message}`;
}

/**
 * The last line of a green run. A step that ran but printed a SKIP line (knip without its export
 * kinds) is counted apart from a step that did not run at all, so a slice run never reads as clean:
 * "verify: 11 steps passed, 0 skipped" only when no SKIP line was printed.
 */
export function verifySummary(passed: number, skipped: number, withSkipLines: number): string {
  const parts = [`${String(passed)} steps passed`];
  if (skipped > 0 || withSkipLines === 0) {
    parts.push(`${String(skipped)} skipped`);
  }
  if (withSkipLines > 0) {
    parts.push(`${String(withSkipLines)} with SKIP lines`);
  }
  return `verify: ${parts.join(', ')}`;
}

/**
 * Runs the steps in order and stops at the first failure, like `a && b && c`. Returns the exit
 * code: the failing step's, or 0 when every step that ran passed.
 */
export function runPlan(
  steps: readonly VerifyStep[],
  execute: (step: VerifyStep) => number,
  print: (line: string) => void,
): number {
  let skipped = 0;
  let withSkipLines = 0;
  for (const step of steps) {
    if (step.skip !== null) {
      print(formatSkip(step.skip));
    }
    if (step.isSkipped) {
      skipped += 1;
      continue;
    }
    const status = execute(step);
    if (status !== 0) {
      print(`verify: step "${step.name}" failed (exit ${String(status)}); later steps did not run`);
      return status;
    }
    if (step.skip !== null) {
      withSkipLines += 1;
    }
  }
  print(verifySummary(steps.length - skipped, skipped, withSkipLines));
  return 0;
}
