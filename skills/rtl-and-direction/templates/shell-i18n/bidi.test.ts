// packages/shell/src/i18n/bidi.test.ts
import { FSI, isolate, PDI, stripIsolates } from './bidi.ts';

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
});
