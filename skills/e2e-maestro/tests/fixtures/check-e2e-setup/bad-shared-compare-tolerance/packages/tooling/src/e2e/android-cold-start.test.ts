// packages/tooling/src/e2e/android-cold-start.test.ts
import fc from 'fast-check';

import {
  emuBaselineFile,
  emuColdStartFactorFrom,
  emuLaunchOf,
  parseAmStart,
} from './android-cold-start.ts';

/** What `adb -s <serial> shell am start -W -S -n <package>/.MainActivity` prints (Android 15). */
const AM_START_COLD = [
  'Stopping: io.applander.linesiege',
  'Starting: Intent { cmp=io.applander.linesiege/.MainActivity }',
  'Status: ok',
  'LaunchState: COLD',
  'Activity: io.applander.linesiege/.MainActivity',
  'TotalTime: 812',
  'WaitTime: 830',
  'Complete',
  '',
].join('\n');

const coldStart = (atEpochMs: number, totalMs: number): unknown => ({
  kind: 'cold-start',
  atEpochMs,
  data: { totalMs },
});

describe('parseAmStart', () => {
  it('reads the status, the launch state and TotalTime (pinned)', () => {
    expect(parseAmStart(AM_START_COLD)).toStrictEqual({
      status: 'ok',
      launchState: 'COLD',
      totalTimeMs: 812,
      waitTimeMs: 830,
    });
  });

  it('reads nothing from an error answer', () => {
    expect(parseAmStart('Error: Activity not started, unable to resolve Intent\n')).toStrictEqual({
      status: null,
      launchState: null,
      totalTimeMs: null,
      waitTimeMs: null,
    });
  });

  it('reads any TotalTime back as written', () => {
    fc.assert(
      fc.property(fc.nat({ max: 600_000 }), (ms) => {
        const text = AM_START_COLD.replace('TotalTime: 812', `TotalTime: ${String(ms)}`);
        return parseAmStart(text).totalTimeMs === ms;
      }),
    );
  });
});

describe('emuLaunchOf', () => {
  it("judges the perf log's newest cold start, with am start's TotalTime beside it", () => {
    const log = [coldStart(1000, 640), coldStart(2000, 702)];
    expect(emuLaunchOf(parseAmStart(AM_START_COLD), log, 1500)).toStrictEqual({
      totalMs: 702,
      amTotalTimeMs: 812,
      launchState: 'COLD',
    });
  });

  it('refuses a launch that was not cold (the app was not stopped first)', () => {
    const warm = parseAmStart(AM_START_COLD.replace('LaunchState: COLD', 'LaunchState: WARM'));
    expect(emuLaunchOf(warm, [coldStart(2000, 702)], 1500)).toBe(
      'cold start: the launch was WARM, not COLD (am start -W -S stops the app first)',
    );
  });

  it('refuses a launch am start did not complete', () => {
    expect(emuLaunchOf(parseAmStart('Error: Activity not started\n'), [], 0)).toBe(
      'cold start: am start did not report Status: ok',
    );
  });

  it('refuses a launch without a newer cold-start entry in the perf log', () => {
    expect(emuLaunchOf(parseAmStart(AM_START_COLD), [coldStart(1000, 640)], 1500)).toBe(
      'cold start: no cold-start entry newer than the launch in the perf log (a test build whose Home calls useColdStartMark?)',
    );
  });
});

describe('emuBaselineFile', () => {
  it('keeps the emulator baseline apart from the simulator one', () => {
    expect(emuBaselineFile('line-siege')).toBe('perf-baselines/cold-start-emu-line-siege.json');
  });
});

describe('emuColdStartFactorFrom', () => {
  it('reads perf.coldStartEmuRegressionFactor from quality-gates.json', () => {
    const gates = {
      perf: { coldStartEmuRegressionFactor: 1.3, coldStartSimRegressionFactor: 1.2 },
    };
    expect(emuColdStartFactorFrom(gates)).toBe(1.3);
  });

  it("falls back to the simulator's factor, then to 1.2", () => {
    expect(emuColdStartFactorFrom({ perf: { coldStartSimRegressionFactor: 1.25 } })).toBe(1.25);
    expect(emuColdStartFactorFrom({})).toBe(1.2);
  });
});
