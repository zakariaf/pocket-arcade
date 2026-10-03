// packages/shell/src/game-host/use-board-clock.test.ts
// The clock's JS driver only: the hook around it needs the UI thread (device-only).
import { createClockDriver } from './use-board-clock.ts';

type Parts = Parameters<ReturnType<typeof createClockDriver>['connect']>[0];

function makeParts(): { parts: Parts; reported: string[]; active: boolean[] } {
  const reported: string[] = [];
  const active: boolean[] = [];
  const parts: Parts = {
    frame: { setActive: (isActive: boolean) => active.push(isActive) },
    sink: null,
    onError: (message) => reported.push(message),
  };
  return { parts, reported, active };
}

const makeDriver = (): ReturnType<typeof createClockDriver> =>
  createClockDriver({ seq: 1, endMs: 0 }, { set: () => undefined });

describe('board clock driver', () => {
  // spec 8.14: "The Shell keeps a small local error log ... and recovers where possible ...
  // never a crash loop": a draw() that throws on the first record must still pause the run.
  it('reports a draw error that came before the board connected, once, when it connects', () => {
    const driver = makeDriver();
    driver.onError('draw failed');
    driver.onError('draw failed again');
    const { parts, reported } = makeParts();
    driver.connect(parts);
    expect(reported).toStrictEqual(['draw failed']);
    driver.connect(parts);
    expect(reported).toStrictEqual(['draw failed']);
  });

  it('reports the first error of each run at once once connected, and halts the frame', () => {
    const driver = makeDriver();
    const { parts, reported, active } = makeParts();
    driver.connect(parts);
    driver.resume();
    driver.onError('first');
    driver.onError('again in the same run');
    expect(reported).toStrictEqual(['first']);
    expect(active).toStrictEqual([true, false]);
    driver.resume();
    driver.onError('after resume');
    expect(reported).toStrictEqual(['first', 'after resume']);
  });
});
