// packages/shell/src/game-host/testing/android-skia.ts
// Android's Skia for the unit-android tests of board digits: its system font manager knows only
// the phone's own fonts and answers an app font with an empty face, while a face made from the
// bundled TTF's bytes is the real one (board-number-typeface.ts). Paints are inert and fonts
// measure every glyph 9 wide. It sits in game-host, the Shell folder game code may import, so the
// Shell's and the games' Android tests share this one fake. No casts in game-host: the stand-in
// becomes a SkiaApi through a type guard that checks, at run time, every factory it carries.
import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';

/** What Skia's Android font manager answers for a family outside /system/fonts: an empty face. */
export const EMPTY_FACE = { kind: 'empty' };

export type AndroidSkia = {
  readonly skia: SkiaApi;
  /** The font data of every face made from bytes, in order (a face is { kind: 'bundled', data }). */
  readonly made: unknown[];
};

/** The Skia factories the board's draw code and digits face call, all of them in the stand-in. */
const FACTORIES = ['Paint', 'Font', 'FontMgr', 'Data', 'Typeface'] as const;

function isSkiaStandIn(value: object): value is SkiaApi {
  return FACTORIES.every((name) => name in value);
}

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
  };
  if (!isSkiaStandIn(skia)) throw new Error('android-skia: the stand-in lacks a Skia factory');
  return { skia, made };
}
