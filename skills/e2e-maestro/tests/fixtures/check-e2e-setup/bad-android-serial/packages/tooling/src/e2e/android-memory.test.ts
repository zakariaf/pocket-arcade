// packages/tooling/src/e2e/android-memory.test.ts
import fc from 'fast-check';

import { judgePss, totalPssKbOf } from './android-memory.ts';

const BUDGETS = { coldStartSimRegressionFactor: 1.2, memoryFootprintMbMax: 150 };

/** `dumpsys meminfo <package>` on Android 15: the table, then the App Summary with TOTAL PSS. */
const MEMINFO_15 = [
  'Applications Memory Usage (in Kilobytes):',
  'Uptime: 1234567 Realtime: 1234567',
  '',
  '** MEMINFO in pid 4321 [io.applander.linesiege] **',
  '                   Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap',
  '                 Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free',
  '                ------   ------   ------   ------   ------   ------   ------   ------',
  '  Native Heap    40112    40020        0        0    41800    52000    45000     7000',
  '        TOTAL    98304    80000     5000        0   160000    58000    48000    10000',
  '',
  ' App Summary',
  '                       Pss(KB)                        Rss(KB)',
  '                        ------                         ------',
  '           Java Heap:     6000                          14000',
  '           TOTAL PSS:    98304            TOTAL RSS:   160000       TOTAL SWAP PSS:        0',
  '',
].join('\n');

/** Older releases print "TOTAL:" in the App Summary instead of "TOTAL PSS:". */
const MEMINFO_OLD = MEMINFO_15.replace('TOTAL PSS:    98304', 'TOTAL:    98304');

describe('totalPssKbOf', () => {
  it("reads the App Summary's TOTAL PSS in KB (pinned)", () => {
    expect(totalPssKbOf(MEMINFO_15)).toBe(98_304);
  });

  it('reads the summary of older releases and, without a summary, the table TOTAL row', () => {
    expect(totalPssKbOf(MEMINFO_OLD)).toBe(98_304);
    const tableOnly = MEMINFO_15.split(' App Summary')[0] ?? '';
    expect(totalPssKbOf(tableOnly)).toBe(98_304);
  });

  it('is null when the app is not running', () => {
    expect(totalPssKbOf('No process found for: io.applander.linesiege\n')).toBeNull();
  });
});

describe('judgePss', () => {
  it('compares total PSS with the same 150 MB budget as the simulator footprint', () => {
    expect(judgePss(98_304, BUDGETS)).toStrictEqual({
      totalPssKb: 98_304,
      totalPssMb: 96,
      limitMb: 150,
      isOver: false,
    });
  });

  it('is over the budget above 150 MB of 1024 KB each', () => {
    expect(judgePss(153_600, BUDGETS).isOver).toBe(false);
    expect(judgePss(153_601, BUDGETS).isOver).toBe(true);
  });

  it('is over exactly when the MB value is above the limit', () => {
    fc.assert(
      fc.property(fc.nat({ max: 400_000 }), (kb) => {
        const result = judgePss(kb, BUDGETS);
        return result.isOver === kb > 150 * 1024 && result.totalPssMb >= 0;
      }),
    );
  });
});
