// packages/tooling/src/storekit/busy-note.test.ts
import { busyNote } from './busy-note.ts';

describe('busyNote', () => {
  it('says nothing while the load average is at most twice the cores', () => {
    expect(busyNote(3.2, 12)).toBeNull();
    expect(busyNote(24, 12)).toBeNull();
  });

  it('names the load, the cores and the rerun threshold on a busy Mac', () => {
    expect(busyNote(560.4, 12)).toBe(
      "storekit: the Mac is busy (load average 560 on 12 cores); StoreKit's test store answers slowly, so a flow may time out with a correct app: rerun on a fresh simulator once the load is below 24",
    );
  });
});
