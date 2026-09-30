// packages/shell/src/screens/debug/font-test-samples.test.ts
import { TYPE_SCALE } from '@e07/shell/theme/tokens.ts';
import { TYPE_STYLES } from '@e07/shell/theme/type-styles.ts';

import { FONT_TEST_SAMPLES, FONT_TEST_VARIANTS, fontTestRowsOf } from './font-test-samples.ts';

describe('the font test page data', () => {
  it('covers every type role and component style once, roles first', () => {
    const count = Object.keys(TYPE_SCALE).length + Object.keys(TYPE_STYLES).length;
    expect(new Set(FONT_TEST_VARIANTS).size).toBe(count);
    expect(FONT_TEST_VARIANTS.slice(0, 7)).toStrictEqual([
      'display',
      'title',
      'number',
      'heading',
      'body',
      'label',
      'caption',
    ]);
  });

  it('samples all four languages, Persian with the madda and every hamza seat', () => {
    expect(FONT_TEST_SAMPLES.map((sample) => sample.language)).toStrictEqual([
      'en',
      'de',
      'fa',
      'ckb',
    ]);
    const persian = FONT_TEST_SAMPLES.find((sample) => sample.language === 'fa')?.text ?? '';
    for (const mark of ['آ', 'ئ', 'أ', 'ؤ', 'ء', '۱']) expect(persian).toContain(mark);
  });

  it('draws the four samples in every variant', () => {
    const rows = fontTestRowsOf(['display', 'levelNumber'], FONT_TEST_SAMPLES);
    expect(rows.map((row) => [row.variant, row.samples.length])).toStrictEqual([
      ['display', 4],
      ['levelNumber', 4],
    ]);
  });
});
