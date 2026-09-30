// packages/tooling/src/quality/verify-plan.test.ts
import { parseShellSlice } from './shell-slice.ts';
import {
  formatSkip,
  KNIP_EXPORT_KINDS,
  runPlan,
  verifyPlan,
  verifySummary,
  type VerifyStep,
} from './verify-plan.ts';

const SLICE = parseShellSlice('{ "screens": ["S4", "S11"], "why": "Home + Settings slice" }');
const GAME_FIRST = parseShellSlice('{ "screens": [], "why": "Line Siege core first" }');

const stepNamed = (steps: readonly VerifyStep[], name: string): VerifyStep | undefined =>
  steps.find((step) => step.name === name);

describe('verifyPlan', () => {
  it('runs all eleven gates strictly without shell-slice.json', () => {
    const steps = verifyPlan({ slice: null, hasSims: false });
    expect(steps.map((step) => step.name)).toStrictEqual([
      'format:check',
      'lint',
      'typecheck',
      'i18n:verify',
      'knip',
      'guardrail',
      'test:coverage',
      'test:sim',
      'audit:network',
      'audit:licenses',
      'check-deps',
    ]);
    expect(steps.filter((step) => step.skip !== null || step.isSkipped)).toStrictEqual([]);
    expect(stepNamed(steps, 'knip')?.command).toStrictEqual(['npm', 'run', '-s', 'knip']);
  });

  it('runs knip without the export and type kinds while a slice exists', () => {
    const knip = stepNamed(verifyPlan({ slice: SLICE, hasSims: true }), 'knip');
    expect(knip?.command).toStrictEqual([
      'npm',
      'run',
      '-s',
      'knip',
      '--',
      '--exclude',
      KNIP_EXPORT_KINDS.join(','),
    ]);
    expect(knip?.isSkipped).toBe(false);
    expect(knip?.skip?.message).toContain('Home + Settings slice');
  });

  it('keeps the dependency, file and binary kinds in knip', () => {
    expect(KNIP_EXPORT_KINDS).not.toContain('dependencies');
    expect(KNIP_EXPORT_KINDS).not.toContain('files');
    expect(KNIP_EXPORT_KINDS).not.toContain('binaries');
  });

  it('skips test:sim only while a slice exists and no sim does', () => {
    expect(
      stepNamed(verifyPlan({ slice: GAME_FIRST, hasSims: false }), 'test:sim')?.isSkipped,
    ).toBe(true);
    expect(stepNamed(verifyPlan({ slice: GAME_FIRST, hasSims: true }), 'test:sim')?.isSkipped).toBe(
      false,
    );
    expect(stepNamed(verifyPlan({ slice: null, hasSims: false }), 'test:sim')?.isSkipped).toBe(
      false,
    );
  });
});

describe('verifySummary', () => {
  it('names skipped steps and steps with SKIP lines apart', () => {
    expect(verifySummary(11, 0, 0)).toBe('verify: 11 steps passed, 0 skipped');
    expect(verifySummary(11, 0, 1)).toBe('verify: 11 steps passed, 1 with SKIP lines');
    expect(verifySummary(10, 1, 1)).toBe('verify: 10 steps passed, 1 skipped, 1 with SKIP lines');
    expect(verifySummary(10, 1, 0)).toBe('verify: 10 steps passed, 1 skipped');
  });
});

describe('formatSkip', () => {
  it('prints the checker SKIP line format', () => {
    expect(formatSkip({ file: 'jest.sim.config.js', rule: 'test-sim', message: 'none yet' })).toBe(
      'SKIP jest.sim.config.js [test-sim] none yet',
    );
  });
});

describe('runPlan', () => {
  const steps = verifyPlan({ slice: SLICE, hasSims: false });

  it('prints the SKIP lines and runs every step that is not skipped', () => {
    const ran: string[] = [];
    const lines: string[] = [];
    const status = runPlan(
      steps,
      (step) => {
        ran.push(step.name);
        return 0;
      },
      (line) => lines.push(line),
    );
    expect(status).toBe(0);
    expect(ran).not.toContain('test:sim');
    expect(ran).toHaveLength(10);
    expect(lines.filter((line) => line.startsWith('SKIP '))).toHaveLength(2);
    expect(lines.at(-1)).toBe('verify: 10 steps passed, 1 skipped, 1 with SKIP lines');
  });

  it('counts a step that ran with a SKIP line, so a slice run never reads as clean', () => {
    const lines: string[] = [];
    const status = runPlan(
      verifyPlan({ slice: SLICE, hasSims: true }),
      () => 0,
      (line) => lines.push(line),
    );
    expect(status).toBe(0);
    expect(lines).toStrictEqual([
      expect.stringMatching(/^SKIP shell-slice\.json \[knip-exports\] /u),
      'verify: 11 steps passed, 1 with SKIP lines',
    ]);
  });

  it('reports a clean run with no SKIP line as 0 skipped', () => {
    const lines: string[] = [];
    const status = runPlan(
      verifyPlan({ slice: null, hasSims: true }),
      () => 0,
      (line) => lines.push(line),
    );
    expect(status).toBe(0);
    expect(lines).toStrictEqual(['verify: 11 steps passed, 0 skipped']);
  });

  it('stops at the first failing step with its exit code', () => {
    const ran: string[] = [];
    const lines: string[] = [];
    const status = runPlan(
      steps,
      (step) => {
        ran.push(step.name);
        return step.name === 'typecheck' ? 2 : 0;
      },
      (line) => lines.push(line),
    );
    expect(status).toBe(2);
    expect(ran).toStrictEqual(['format:check', 'lint', 'typecheck']);
    expect(lines.at(-1)).toBe('verify: step "typecheck" failed (exit 2); later steps did not run');
  });
});
