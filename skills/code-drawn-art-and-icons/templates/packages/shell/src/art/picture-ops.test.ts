// packages/shell/src/art/picture-ops.test.ts
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { emptyStatsOps, HAZARD, hazardStripeOps } from './picture-ops.ts';

const COLORS = TEST_PALETTE.standard.light;
const PRINTED = { toyInk: '#1D1B3A', white: '#FFFFFF' };

describe('picture ops', () => {
  it('paints the empty-statistics box from the theme: pop lid, accent box, dashed ink star', () => {
    const ops = emptyStatsOps(COLORS, PRINTED);

    expect(ops[0]).toMatchObject({ style: 'fill', color: COLORS.pop, rotate: { deg: -6 } });
    expect(ops.find((op) => op.dash !== undefined)).toMatchObject({
      color: COLORS.text,
      width: 3,
      dash: [5, 5],
    });
    expect(ops.filter((op) => op.color === COLORS.primary)).toHaveLength(1);
  });

  it('keeps the hazard stripes between the two 3 pt ink rules', () => {
    const [band, stripes] = hazardStripeOps(390, { gold: '#FFC928', toyInk: '#1D1B3A' });
    const ys = [...(stripes?.d ?? '').matchAll(/-?[\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]));

    expect(band).toMatchObject({ color: '#1D1B3A', d: `M0 0H390V${String(HAZARD.height)}H0Z` });
    expect(stripes?.color).toBe('#FFC928');
    expect(Math.min(...ys)).toBe(HAZARD.rule);
    expect(Math.max(...ys)).toBe(HAZARD.height - HAZARD.rule);
  });

  it("lays the stripes from the band's right edge, as the design's centred CSS gradient does (S15)", () => {
    // The design's 402 pt band: gold along the bottom from 11.7 to 28.7 pt, then every 33.9 pt, and
    // the last stripe ends exactly at the right edge.
    const run = HAZARD.stripe * Math.SQRT2;
    const inner = HAZARD.height - HAZARD.rule * 2;
    const [, stripes] = hazardStripeOps(402, { gold: '#FFC928', toyInk: '#1D1B3A' });
    // Each parallelogram starts with "M<x> <bottom>": its left edge along the band's bottom.
    const bottomStarts = [...(stripes?.d ?? '').matchAll(/M(-?[\d.]+) /g)].map((m) => Number(m[1]));

    expect(bottomStarts.find((x) => x > 0)).toBeCloseTo(11.68, 1);
    expect(bottomStarts.at(-1)).toBeCloseTo(402 - run, 6);
    // The first stripe reaches past the left edge, so the band never starts with a gap.
    expect(bottomStarts[0]).toBeLessThanOrEqual(-inner);
  });
});
