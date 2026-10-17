// packages/shell/src/ui/line-breaks.test.ts
// The design (Chrome) and iOS may end a line after a hyphen inside a word ("right-to- / left",
// "public- / domain", Unicode line breaking rule HY). Android's line breaker does not without
// hyphenation, so S11a's note and S11b's credits line wrapped a word earlier there (E18-T22).
import fc from 'fast-check';

import { withHyphenBreaks } from './line-breaks.ts';

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
