// test/integration/toybox-font-glyphs.test.ts
// The bundled Toybox faces, read from each app's TTFs: which draw a no-break space (U+00A0) of
// their own. Android draws a missing glyph from a fallback font whose space is wider (1.7 pt at
// 30 pt for Lilita One, E18-T23), so AppText marks a no-break space only for a face without one.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FONT_FAMILIES } from '@e07/shell/i18n/fonts.ts';
import { hasOwnNoBreakSpace } from '@e07/shell/ui/line-breaks.ts';

const APPS = join(__dirname, '..', '..', 'apps');
const SPACE = 0x20;
const NO_BREAK_SPACE = 0xa0;

type Font = { readonly bytes: Buffer; readonly tables: ReadonlyMap<string, number> };

function fontOf(path: string): Font {
  const bytes = readFileSync(path);
  const tables = new Map<string, number>();
  for (let index = 0; index < bytes.readUInt16BE(4); index += 1) {
    const record = 12 + index * 16;
    tables.set(bytes.toString('latin1', record, record + 4), bytes.readUInt32BE(record + 8));
  }
  return { bytes, tables };
}

function tableOf(font: Font, tag: string): number {
  const offset = font.tables.get(tag);
  if (offset === undefined) throw new Error(`no ${tag} table`);
  return offset;
}

/** The glyph a BMP code point maps to in the Windows Unicode cmap (format 4), or 0 for none. */
function glyphOf(font: Font, codePoint: number): number {
  const { bytes } = font;
  const cmap = tableOf(font, 'cmap');
  for (let index = 0; index < bytes.readUInt16BE(cmap + 2); index += 1) {
    const record = cmap + 4 + index * 8;
    const isUnicode = bytes.readUInt16BE(record) === 3 && bytes.readUInt16BE(record + 2) === 1;
    const table = cmap + bytes.readUInt32BE(record + 4);
    if (!isUnicode || bytes.readUInt16BE(table) !== 4) continue;
    const segments = bytes.readUInt16BE(table + 6) / 2;
    const ends = table + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const ranges = deltas + segments * 2;
    for (let segment = 0; segment < segments; segment += 1) {
      const start = bytes.readUInt16BE(starts + segment * 2);
      if (codePoint < start || codePoint > bytes.readUInt16BE(ends + segment * 2)) continue;
      const delta = bytes.readInt16BE(deltas + segment * 2);
      const range = bytes.readUInt16BE(ranges + segment * 2);
      if (range === 0) return (codePoint + delta) & 0xffff;
      const at = ranges + segment * 2 + range + (codePoint - start) * 2;
      const glyph = bytes.readUInt16BE(at);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
  }
  return 0;
}

/** A glyph's advance width in font units (hmtx). */
function advanceOf(font: Font, glyph: number): number {
  const metrics = font.bytes.readUInt16BE(tableOf(font, 'hhea') + 34);
  return font.bytes.readUInt16BE(tableOf(font, 'hmtx') + 4 * Math.min(glyph, metrics - 1));
}

const FAMILIES = Object.values(FONT_FAMILIES);
const APP_FONT_DIRS = readdirSync(APPS)
  .map((app) => join(APPS, app, 'assets', 'fonts'))
  .filter((dir) => readdirSync(dir).length > 0);

describe('Toybox faces and the no-break space (spec 15.1)', () => {
  it.each(APP_FONT_DIRS)(
    'finds in %s that only Lilita One lacks U+00A0, as AppText marks it',
    (dir) => {
      const drawn = FAMILIES.map((family) => {
        const font = fontOf(join(dir, `${family}.ttf`));
        return [family, glyphOf(font, NO_BREAK_SPACE) !== 0] as const;
      });
      expect(drawn).toStrictEqual(FAMILIES.map((family) => [family, hasOwnNoBreakSpace(family)]));
      expect(drawn.filter(([, isDrawn]) => !isDrawn).map(([family]) => family)).toStrictEqual([
        'LilitaOne',
      ]);
    },
  );

  it.each(APP_FONT_DIRS)(
    'finds in %s each own U+00A0 exactly as wide as its face’s space',
    (dir) => {
      for (const family of FAMILIES.filter(hasOwnNoBreakSpace)) {
        const font = fontOf(join(dir, `${family}.ttf`));
        const space = advanceOf(font, glyphOf(font, SPACE));
        expect([family, advanceOf(font, glyphOf(font, NO_BREAK_SPACE))]).toStrictEqual([
          family,
          space,
        ]);
      }
    },
  );

  it('pins the widths: Rubik 245 and 213 of 1000, Vazirmatn 550 and 516 of 2048', () => {
    const dir = join(APPS, 'line-siege', 'assets', 'fonts');
    const widths = ['Rubik-Regular', 'Rubik-Bold', 'Vazirmatn-Regular', 'Vazirmatn-Bold'].map(
      (family) => {
        const font = fontOf(join(dir, `${family}.ttf`));
        return advanceOf(font, glyphOf(font, NO_BREAK_SPACE));
      },
    );
    expect(widths).toStrictEqual([245, 213, 550, 516]);
  });
});
