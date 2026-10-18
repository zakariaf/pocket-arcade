// packages/shell/src/i18n/bidi.test.ts
import fc from 'fast-check';

import {
  asRtlParagraph,
  firstStrongDirection,
  FSI,
  isInvisibleMark,
  isolate,
  PDI,
  RLM,
  stripIsolates,
  WORD_JOINER,
  ZERO_WIDTH_SPACE,
} from './bidi.ts';

describe('isolate', () => {
  it('wraps free text in FIRST STRONG ISOLATE ... POP DIRECTIONAL ISOLATE', () => {
    expect(isolate('Line Siege')).toBe(`${FSI}Line Siege${PDI}`);
    expect(FSI.codePointAt(0)).toBe(0x2068);
    expect(PDI.codePointAt(0)).toBe(0x2069);
  });

  it('removes the isolates again with stripIsolates', () => {
    expect(stripIsolates(`برای باز کردن ${isolate('Beginnings')}`)).toBe(
      'برای باز کردن Beginnings',
    );
  });

  it('gives back any text without isolates unchanged after isolate and strip (spec 7.4)', () => {
    const textWithoutIsolates = fc
      .string({ unit: 'binary' })
      .filter((text) => !/[\u2068\u2069]/u.test(text));
    fc.assert(
      fc.property(textWithoutIsolates, (text) => {
        expect(stripIsolates(isolate(text))).toBe(text);
      }),
    );
  });
});

describe('isInvisibleMark', () => {
  it('finds the marks a line break looks through: ALM, ZWJ, LRM, RLM, the isolates and the BOM', () => {
    for (const code of [0x061c, 0x200d, 0x200e, 0x200f, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff]) {
      expect(isInvisibleMark(String.fromCodePoint(code))).toBe(true);
    }
  });

  it("finds the break marks Android's text carries too: the zero-width space and the word joiner", () => {
    // line-breaks.ts draws them (a break point after an in-word hyphen, a no-break space held by
    // word joiners), and the balanced wrap reads Android's lines as drawn (spec 15.1).
    expect(
      [0x200b, 0x2060].map((code) => isInvisibleMark(String.fromCodePoint(code))),
    ).toStrictEqual([true, true]);
    expect([ZERO_WIDTH_SPACE, WORD_JOINER].map((mark) => mark.codePointAt(0))).toStrictEqual([
      0x200b, 0x2060,
    ]);
  });

  it('treats letters, digits, spaces and the zero-width non-joiner as drawn text', () => {
    for (const char of ['a', 'ب', '۳', ' ', '-', String.fromCodePoint(0x200c)]) {
      expect(isInvisibleMark(char)).toBe(false);
    }
  });
});

describe('firstStrongDirection', () => {
  it.each([
    ['Line Siege', 'ltr'],
    ['آمار', 'rtl'],
    ['ئاستی ۳', 'rtl'],
    ['۲۸ / ۲۷۰', null],
    ['×۶', null],
    [`${isolate('یکشنبه')}، ۲۷ ${isolate('سپتامبر')}`, null],
    [`${isolate('Line Siege')} آفلاین کار می‌کند.`, 'rtl'],
    [`${isolate('آمار')} for you`, 'ltr'],
  ] as const)('reads %s as %s: the first letter outside isolates (spec 7.4)', (text, direction) => {
    expect(firstStrongDirection(text)).toBe(direction);
  });
});

describe('asRtlParagraph', () => {
  it('starts a text without a strong letter with a right-to-left mark (spec N11)', () => {
    // Android's text layout reads such a text left to right (FIRSTSTRONG_LTR); a TextView in an RTL
    // layout read it right to left. The mark gives the drawn layout the paragraph direction back.
    expect(asRtlParagraph('۲۸ / ۲۷۰')).toBe(`${RLM}۲۸ / ۲۷۰`);
    expect(asRtlParagraph(`${isolate('یکشنبه')}، ۲۷`)).toBe(`${RLM}${isolate('یکشنبه')}، ۲۷`);
  });

  it('leaves a text with a strong letter, or a single number, as written', () => {
    // A single number reads the same in either paragraph direction ("۵۸", "۱٫۹۹").
    for (const text of [
      'آمار',
      'ئاستی ۳',
      'Vazirmatn 33.003',
      `${isolate('Line Siege')} آفلاین`,
      '۵۸',
      '۱٫۹۹',
      '12',
    ]) {
      expect(asRtlParagraph(text)).toBe(text);
    }
  });

  it('adds at most one mark, and only marks: removing it gives the text back', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom('۲', ' ', '/', 'a', 'ب', FSI, PDI) }),
        (text) => {
          const shown = asRtlParagraph(text);
          expect(asRtlParagraph(shown)).toBe(shown);
          expect(shown.startsWith(RLM) ? shown.slice(1) : shown).toBe(text);
        },
      ),
    );
  });
});
