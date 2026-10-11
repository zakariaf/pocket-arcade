// packages/shell/src/screens/debug/font-test-samples.test.ts
import { TYPE_SCALE } from '@e07/shell/theme/tokens.ts';
import { TYPE_STYLES } from '@e07/shell/theme/type-styles.ts';

import {
  FONT_TEST_ALPHABETS,
  FONT_TEST_SAMPLES,
  FONT_TEST_VARIANTS,
  fontTestRowsOf,
} from './font-test-samples.ts';

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

// Spec 7.6: "A test page (debug menu) renders every letter and digit in every font", the
// Sorani-only letters ڕ ڵ ۆ ێ ە ڤ included. The sets are written out here, never imported from
// the data they check.
/** Space-separated glyphs, so marks and Arabic letters stay whole. */
const glyphs = (text: string): readonly string[] => text.split(' ');
const LATIN_UPPER = 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z';
const LATIN_LOWER = 'a b c d e f g h i j k l m n o p q r s t u v w x y z';
const LATIN_DIGITS = '0 1 2 3 4 5 6 7 8 9';
const EXPECTED: Readonly<Record<'en' | 'de' | 'fa' | 'ckb', readonly string[]>> = {
  en: glyphs(`${LATIN_UPPER} ${LATIN_LOWER} ${LATIN_DIGITS}`),
  de: glyphs(`${LATIN_UPPER} ${LATIN_LOWER} Ä Ö Ü ä ö ü ß ${LATIN_DIGITS}`),
  fa: glyphs(
    'ا ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ه ی آ ئ أ ؤ ء ۰ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹',
  ),
  ckb: glyphs(
    'ئ ا ب پ ت ج چ ح خ د ر ڕ ز ژ س ش ع غ ف ڤ ق ک گ ل ڵ م ن و ۆ ە ھ ی ێ ٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩',
  ),
};

function alphabetOf(language: keyof typeof EXPECTED): string {
  return FONT_TEST_ALPHABETS.find((alphabet) => alphabet.language === language)?.text ?? '';
}

describe('the font test page alphabets (spec 7.6)', () => {
  it.each(Object.keys(EXPECTED) as (keyof typeof EXPECTED)[])(
    'holds every letter and digit of %s (spec 7.6)',
    (language) => {
      const text = alphabetOf(language);
      expect(EXPECTED[language].filter((glyph) => !text.includes(glyph))).toStrictEqual([]);
    },
  );

  it('writes Persian with the Persian ی and ک, never the Arabic ي and ك', () => {
    expect(['ي', 'ك'].filter((glyph) => alphabetOf('fa').includes(glyph))).toStrictEqual([]);
  });

  it('carries the Sorani-only letters ڕ ڵ ۆ ێ ە ڤ (spec 7.6)', () => {
    expect(
      glyphs('ڕ ڵ ۆ ێ ە ڤ').filter((glyph) => !alphabetOf('ckb').includes(glyph)),
    ).toStrictEqual([]);
  });

  it('gives every row of the page the four alphabets', () => {
    const rows = fontTestRowsOf(FONT_TEST_VARIANTS, FONT_TEST_SAMPLES);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows)
      expect(row.alphabets.map((alphabet) => alphabet.language)).toStrictEqual([
        'en',
        'de',
        'fa',
        'ckb',
      ]);
  });
});
