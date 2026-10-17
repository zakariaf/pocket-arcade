// packages/shell/src/ui/line-breaks.test.ts
// The design (Chrome) and iOS may end a line after a hyphen inside a word ("right-to- / left",
// "public- / domain", Unicode line breaking rule HY). Android's line breaker does not without
// hyphenation, so S11a's note and S11b's credits line wrapped a word earlier there (E18-T22).
import fc from 'fast-check';

import { RLM } from '@e07/shell/i18n/bidi.ts';

import { androidMarksOf, withFontSpaces, withHyphenBreaks } from './line-breaks.ts';

const ZWSP = '​';

describe('withHyphenBreaks', () => {
  it.each([
    ['right-to-left', `right-${ZWSP}to-${ZWSP}left`],
    ['public-domain sources', `public-${ZWSP}domain sources`],
    ['E-Mail', `E-${ZWSP}Mail`],
    ['چپ-به-راست', `چپ-${ZWSP}به-${ZWSP}راست`],
  ])('lets a line end after the in-word hyphen of %s (spec 15.1)', (text, shown) => {
    expect(withHyphenBreaks(text)).toBe(shown);
  });

  it.each([['1-2'], ['a - b'], ['-start'], ['end-'], ['x-1'], ['plain words']])(
    'leaves %s as written: no hyphen between two letters',
    (text) => {
      expect(withHyphenBreaks(text)).toBe(text);
    },
  );

  it('adds only invisible break points: removing them gives the text back, and twice is once', () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom('a', 'b', '-', ' ', '1', 'ب') }), (text) => {
        const shown = withHyphenBreaks(text);
        expect(shown.replaceAll(ZWSP, '')).toBe(text);
        expect(withHyphenBreaks(shown)).toBe(shown);
      }),
    );
  });

  it('pins the S11a note', () => {
    expect(withHyphenBreaks('Persian and Sorani use a right-to-left layout.')).toBe(
      `Persian and Sorani use a right-${ZWSP}to-${ZWSP}left layout.`,
    );
  });
});

describe('withFontSpaces', () => {
  // Lilita One has no U+00A0: Android drew German "62 %" and "1,99 €" with a fallback font's
  // wider space (E18-T23). A plain space held by word joiners draws the font's own space unbroken.
  it.each([
    ['62\u00A0%', '62\u2060 \u2060%'],
    ['1,99\u00A0€', '1,99\u2060 \u2060€'],
    ['Kaufen – 1,99\u00A0€', 'Kaufen – 1,99\u2060 \u2060€'],
  ])(
    'keeps the no-break space of %j unbroken in the font’s own space (spec 15.1)',
    (text, shown) => {
      expect(withFontSpaces(text)).toBe(shown);
    },
  );

  it('leaves a text without a no-break space as written', () => {
    expect(withFontSpaces('62 %')).toBe('62 %');
    expect(withFontSpaces('Level 12')).toBe('Level 12');
  });

  it('adds only word joiners and turns each no-break space into a space', () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom('a', ' ', '\u00A0', '1', '€') }), (text) => {
        const shown = withFontSpaces(text);
        expect(shown.replaceAll('\u2060', '')).toBe(text.replaceAll('\u00A0', ' '));
        expect(shown).not.toContain('\u00A0');
      }),
    );
  });
});

describe('androidMarksOf', () => {
  it('adds the break points, and in a right-to-left paragraph the mark before a text without letters', () => {
    expect(androidMarksOf('۲۸ / ۲۷۰', true)).toBe(`${RLM}۲۸ / ۲۷۰`);
    expect(androidMarksOf('۲۸ / ۲۷۰', false)).toBe('۲۸ / ۲۷۰');
    expect(androidMarksOf('right-to-left', true)).toBe(`right-${ZWSP}to-${ZWSP}left`);
    expect(androidMarksOf('چپ-به-راست', true)).toBe(`چپ-${ZWSP}به-${ZWSP}راست`);
    expect(androidMarksOf('1,99\u00A0€', false)).toBe('1,99\u2060 \u2060€');
  });
});
