// packages/shell/src/game-host/board-number-typeface.ts
// The typeface the board draws its digits with (RenderKit.numberFont, spec 7.x fonts): the app's
// bundled Vazirmatn, made from the TTF's own bytes on both platforms. Never ask Skia's system font
// manager for it: on Android that manager reads only /system/fonts and answers a family it lacks
// with an empty face, so every digit a board draws would be blank there, while iOS (CoreText sees
// the plugin's UIAppFonts) draws them. One path on both platforms means the simulator, the
// emulator and the pixel goldens all draw the digits the same way.
import type { SkiaApi } from './board-types.ts';
import type { SkTypeface } from '@shopify/react-native-skia';

/** The bundled face the board draws its digits with (the expo-font plugin embeds it in the app). */
export const BOARD_NUMBER_FONT_FILE = 'Vazirmatn-Regular.ttf';

/** Reads one font file the app bundles, or null when the app has none by that name. */
export type FontBytesReader = (fileName: string) => Uint8Array | null;

/**
 * The native module BoardFont, the same surface on both platforms: the bytes of a font the
 * expo-font plugin bundled (iOS: the app bundle; Android: the APK's assets/fonts/), or null.
 */
export type BoardFontModule = { readFontBytes(fileName: string): Uint8Array | null };

export function bundledFontReaderOf(module: BoardFontModule | null): FontBytesReader {
  return (fileName) => module?.readFontBytes(fileName) ?? null;
}

/** The digits face from the bundled TTF, or null (no such font: the board then draws no digits). */
export function boardNumberTypefaceOf(
  skia: SkiaApi,
  readFontBytes: FontBytesReader,
): SkTypeface | null {
  const bytes = readFontBytes(BOARD_NUMBER_FONT_FILE);
  if (bytes === null || bytes.length === 0) return null;
  return skia.Typeface.MakeFreeTypeFaceFromData(skia.Data.fromBytes(bytes));
}

/** The family and style the iOS fallback asks the system font manager for. */
const NUMBER_FAMILY = 'Vazirmatn';
const NUMBER_STYLE = { weight: 400, width: 5, slant: 0 } as const;

/**
 * The digits face: from the bundled TTF's bytes first. Without them (no BoardFont module in the
 * build, or no bytes), iOS falls back to the system font manager, which sees the fonts the
 * expo-font plugin embeds (UIAppFonts). Android never does: its manager answers an app font with
 * an empty face, which draws nothing, so it gets null (no digits) instead.
 */
export function boardNumberFaceOf(
  skia: SkiaApi,
  readFontBytes: FontBytesReader,
  os: string,
): SkTypeface | null {
  const bundled = boardNumberTypefaceOf(skia, readFontBytes);
  if (bundled !== null || os !== 'ios') return bundled;
  return skia.FontMgr.System().matchFamilyStyle(NUMBER_FAMILY, NUMBER_STYLE);
}

/** Makes the face once it is found; while none is found, each call tries again (no null kept). */
export function onceFound(make: () => SkTypeface | null): () => SkTypeface | null {
  let face: SkTypeface | null = null;
  return () => {
    face ??= make();
    return face;
  };
}
