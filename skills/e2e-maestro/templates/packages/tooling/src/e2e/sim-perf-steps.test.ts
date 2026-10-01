// packages/tooling/src/e2e/sim-perf-steps.test.ts
// The memory step's order over fake simulator operations. The feedback evidence is read right after
// the smoke flows (the perf log still holds their cues). Maestro 2.10 stops the app when a test
// ends, so footprint measures only after the runner started the app again and it settled.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { measureMemory, RELAUNCH_SETTLE_MS } from './sim-perf-steps.ts';
import { DEFAULT_PERF_BUDGETS } from './sim-perf.ts';

import type { MemoryOps } from './sim-perf-steps.ts';

const FOOTPRINT = { processes: [{ auxiliary: { phys_footprint: 48_433_240 } }] };

type Script = {
  /** How many pid lookups after the relaunch return nothing yet. */
  readonly pidLookupsBeforeStart?: number;
  readonly flowStatus?: number;
  readonly isStarting?: boolean;
};

function fakeOps(calls: string[], script: Script = {}): MemoryOps {
  let isRunning = false;
  let lookups = 0;
  return {
    smokeFlows: () => ['apps/demo/e2e/flows/smoke/10-level-1.yaml'],
    runFlows: (flows) => {
      calls.push(`maestro test ${flows.join(' ')}`);
      isRunning = false; // Maestro 2.10 stops the app when the test ends.
      return Promise.resolve(script.flowStatus ?? 0);
    },
    recordFeedback: (flows) => {
      calls.push(`feedback after ${flows.join(' ')}`);
    },
    relaunch: () => {
      calls.push('simctl launch');
      isRunning = script.isStarting ?? true;
    },
    pid: () => {
      lookups += 1;
      calls.push('pid');
      return isRunning && lookups > (script.pidLookupsBeforeStart ?? 0) ? '4242' : null;
    },
    wait: (ms) => {
      calls.push(`wait ${String(ms)}`);
      return Promise.resolve();
    },
    footprint: (pid) => {
      calls.push(`footprint ${pid}`);
      return FOOTPRINT;
    },
  };
}

describe('measureMemory', () => {
  let out = '';
  beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), 'sim-perf-steps-'));
  });
  afterEach(() => {
    rmSync(out, { recursive: true, force: true });
  });

  it('reads the feedback, then relaunches the app before footprint: smoke flows, feedback, relaunch, pid, 10 s settle, footprint', async () => {
    const calls: string[] = [];
    const result = await measureMemory(
      { game: 'demo', out },
      DEFAULT_PERF_BUDGETS,
      fakeOps(calls, { pidLookupsBeforeStart: 1 }),
    );
    expect(calls).toStrictEqual([
      'maestro test apps/demo/e2e/flows/smoke/10-level-1.yaml',
      'feedback after apps/demo/e2e/flows/smoke/10-level-1.yaml',
      'simctl launch',
      'pid',
      'wait 250',
      'pid',
      `wait ${String(RELAUNCH_SETTLE_MS)}`,
      'footprint 4242',
    ]);
    expect(result).toStrictEqual({
      physFootprintBytes: 48_433_240,
      physFootprintMb: 46.2,
      limitMb: 150,
      isOver: false,
    });
  });

  it('fails when the app does not start again, instead of measuring nothing', async () => {
    const calls: string[] = [];
    await expect(
      measureMemory(
        { game: 'demo', out },
        DEFAULT_PERF_BUDGETS,
        fakeOps(calls, { isStarting: false }),
      ),
    ).rejects.toThrow('memory: the app did not start again after the smoke flow');
    expect(calls).not.toContain('footprint 4242');
  });

  it('skips the feedback and the relaunch after a failed smoke flow', async () => {
    const calls: string[] = [];
    await expect(
      measureMemory({ game: 'demo', out }, DEFAULT_PERF_BUDGETS, fakeOps(calls, { flowStatus: 1 })),
    ).rejects.toThrow('memory: the smoke flow failed before the measurement');
    expect(calls).toStrictEqual(['maestro test apps/demo/e2e/flows/smoke/10-level-1.yaml']);
  });
});
