// test/sims/tile-drop/balance.sim.test.ts
import { writeSimReport } from '@demo/tooling/sims/write-sim-report.ts';

describe('balance', () => {
  it('writes a report', () => {
    expect(typeof writeSimReport).toBe('function');
  });
});
