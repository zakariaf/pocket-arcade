// packages/tooling/src/e2e/android-memory.test.ts
import fc from 'fast-check';

import { judgeMemory, memoryOf, totalPssKbOf } from './android-memory.ts';

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

/** The run-3 reading of E18-T24 (Line Siege, API 35 emulator): private dirty under, PSS over. */
const MEMINFO_E18 = [
  '** MEMINFO in pid 14319 [io.applander.linesiege] **',
  '                   Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap',
  '                 Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free',
  '                ------   ------   ------   ------   ------   ------   ------   ------',
  '  Native Heap    67012    66876       96       49    67780    83580    71209     8030',
  '    .dex mmap    28492        4    28452        0    29252',
  '        TOTAL   216122   113616    88808      426   300640    98611    78725    15545',
  '',
  ' App Summary',
  '           TOTAL PSS:   216122            TOTAL RSS:   300640       TOTAL SWAP PSS:      426',
  '',
].join('\n');

describe('memoryOf', () => {
  it("reads the table's TOTAL private dirty, the swap PSS and the total PSS in KB (pinned)", () => {
    expect(memoryOf(MEMINFO_E18)).toStrictEqual({
      totalPssKb: 216_122,
      privateDirtyKb: 113_616,
      swapPssKb: 426,
    });
  });

  it('counts no swap where the device reports none, and is null without a process', () => {
    expect(memoryOf(MEMINFO_15)).toStrictEqual({
      totalPssKb: 98_304,
      privateDirtyKb: 80_000,
      swapPssKb: 0,
    });
    expect(memoryOf('No process found for: io.applander.linesiege\n')).toBeNull();
  });
});

describe('judgeMemory', () => {
  it('judges private dirty + swap, like the iOS footprint, and keeps total PSS as information', () => {
    expect(
      judgeMemory({ totalPssKb: 216_122, privateDirtyKb: 113_616, swapPssKb: 426 }, BUDGETS),
    ).toStrictEqual({
      footprintKb: 114_042,
      footprintMb: 111.4,
      privateDirtyKb: 113_616,
      swapPssKb: 426,
      totalPssKb: 216_122,
      totalPssMb: 211.1,
      limitMb: 150,
      isOver: false,
    });
  });

  it('is over when private dirty + swap is above 150 MB, whatever the total PSS', () => {
    const over = { totalPssKb: 140_000, privateDirtyKb: 153_000, swapPssKb: 601 };
    expect(judgeMemory(over, BUDGETS).isOver).toBe(true);
    expect(judgeMemory({ ...over, swapPssKb: 600 }, BUDGETS).isOver).toBe(false);
  });

  it('is over exactly when the footprint in KB is above the limit', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 300_000 }),
        fc.nat({ max: 50_000 }),
        fc.nat({ max: 400_000 }),
        (dirty, swap, pss) => {
          const result = judgeMemory(
            { totalPssKb: pss, privateDirtyKb: dirty, swapPssKb: swap },
            BUDGETS,
          );
          return result.isOver === dirty + swap > 150 * 1024 && result.footprintKb === dirty + swap;
        },
      ),
    );
  });
});
