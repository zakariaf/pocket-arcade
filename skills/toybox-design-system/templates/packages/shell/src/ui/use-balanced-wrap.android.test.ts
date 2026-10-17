// packages/shell/src/ui/use-balanced-wrap.android.test.ts
// The Android half of the balanced wrap (the unit-android project): Android lets a line's trailing
// space hang past the room but counts it in the width onTextLayout reports, so a probe can keep a
// line that reads wider than the room the pad leaves.
import { advance, afterTextLayout, isStale } from './use-balanced-wrap.ts';

import type { Measure } from './use-balanced-wrap.ts';

// S13 step 2 in Persian (Vazirmatn Bold 21 in a 362 pt column), the line widths the emulator sent.
const STEP_2 = 'یک ستون را پر کنید تا در مسیر خودش پرتو شلیک کند.';
const FULL_WIDTH = [357.7682189941406, 90.57682037353516];
const AT_293 = [257.2421875, 191.1028594970703];

function probingAt256(): Measure {
  const waiting = afterTextLayout(
    { text: STEP_2, width: 0, lineWidths: null, search: null },
    STEP_2,
    FULL_WIDTH,
  );
  const first = advance({ ...waiting, width: 362 });
  return afterTextLayout(first, STEP_2, AT_293);
}

describe('balanced wrap on Android (a trailing space counted in the line width)', () => {
  // Spec S13: "3-5 short illustrated steps drawn in code (from the game module)", and 15.1: each
  // screen matches its Toybox design, which balances this heading as "... تا در / مسیر ...".
  it('takes a probe that kept a line wider than its room as that probe’s own layout (spec S13, 15.1)', () => {
    const probing = probingAt256();
    expect(probing.search).toMatchObject({ hi: 293, pad: 362 - 256, isDone: false });
    // At 256 pt Android keeps "... تا در مسیر " (251.98 pt and a 5.30 pt space) on the first line.
    const next = afterTextLayout(probing, STEP_2, AT_293);
    expect(next.search).toMatchObject({ hi: 256, pad: 362 - 240, isDone: false });
  });

  it('keeps the design’s break when the next probe moves the last word down', () => {
    const at256 = afterTextLayout(probingAt256(), STEP_2, AT_293);
    const next = afterTextLayout(at256, STEP_2, [205.53, 242.16]);
    expect(next.search).toMatchObject({ hi: 240, widest: 242.16, isDone: false });
  });

  it('keeps every layout, never a stale one: Fabric sends a text layout only for a new layout', () => {
    expect(isStale(probingAt256(), AT_293)).toBe(false);
  });
});
