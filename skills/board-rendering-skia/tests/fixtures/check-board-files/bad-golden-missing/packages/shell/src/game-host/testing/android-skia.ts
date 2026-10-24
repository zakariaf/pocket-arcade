// packages/shell/src/game-host/testing/android-skia.ts
// Android's Skia for the unit-android tests of board digits: its system font manager knows only
// the phone's own fonts and answers an app font with an empty face, while a face made from the
// bundled TTF's bytes is the real one (board-number-typeface.ts). Paints are inert and fonts
// measure every glyph 9 wide. It sits in game-host, the Shell folder game code may import, so the
// Shell's and the games' Android tests share this one fake.
import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkTypeface } from '@shopify/react-native-skia';

/** What Skia's Android font manager answers for a family outside /system/fonts: an empty face. */
export const EMPTY_FACE = { kind: 'empty' } as unknown as SkTypeface;

export type AndroidSkia = {
  readonly skia: SkiaApi;
  /** The font data of every face made from bytes, in order (a face is { kind: 'bundled', data }). */
  readonly made: unknown[];
};

export function androidSkia(): AndroidSkia {
  const made: unknown[] = [];
  const paint = (): unknown => new Proxy({}, { get: () => () => undefined });
  const font = (face: unknown): unknown => ({
    face,
    getGlyphIDs: (text: string) => Array.from({ length: text.length }, () => 7),
    getGlyphWidths: (ids: readonly number[]) => ids.map(() => 9),
    getSize: () => 18,
  });
  const systemManager = (): unknown => ({ matchFamilyStyle: () => EMPTY_FACE });
  const makeFace = (data: unknown): unknown => {
    made.push(data);
    return { kind: 'bundled', data };
  };
  // Skia's factory names are PascalCase; the stand-ins are assigned, not declared, under them.
  const skia = {
    Paint: paint,
    Font: font,
    FontMgr: { System: systemManager },
    Data: { fromBytes: (bytes: Uint8Array) => ({ bytes }) },
    Typeface: { MakeFreeTypeFaceFromData: makeFace },
  } as unknown as SkiaApi;
  return { skia, made };
}
