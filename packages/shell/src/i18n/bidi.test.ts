// packages/shell/src/i18n/bidi.test.ts
import fc from 'fast-check';

import { FSI, isInvisibleMark, isolate, PDI, stripIsolates } from './bidi.ts';

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

  it('treats letters, digits, spaces and the zero-width non-joiner as drawn text', () => {
    for (const char of ['a', 'ب', '۳', ' ', '-', String.fromCodePoint(0x200c)]) {
      expect(isInvisibleMark(char)).toBe(false);
    }
  });
});
