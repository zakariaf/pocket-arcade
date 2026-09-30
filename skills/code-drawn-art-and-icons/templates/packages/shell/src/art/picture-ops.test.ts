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
});
