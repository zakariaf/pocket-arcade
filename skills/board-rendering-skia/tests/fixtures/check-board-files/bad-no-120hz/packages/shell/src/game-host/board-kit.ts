// packages/shell/src/game-host/board-kit.ts
// Imports Skia TYPES only and receives the Skia API as a parameter, so the same code runs
// on device (Skia from the package), in Jest goldens (CanvasKit mock) and in Node art
// scripts (getSkiaExports() from the headless build).
import type { BoardColors, RenderKit, SkiaApi } from './board-types.ts';
import type { SkColor, SkPath, SkTypeface } from '@shopify/react-native-skia';

/** Hex colours per semantic token, one set per scheme. */
export type BoardPalette<TToken extends string> = Readonly<Record<TToken, string>>;

export type PaletteSet<TToken extends string> = {
  readonly light: BoardPalette<TToken>;
  readonly dark: BoardPalette<TToken>;
  readonly colorBlindLight: BoardPalette<TToken>;
  readonly colorBlindDark: BoardPalette<TToken>;
};

export type ColorChoice = { readonly scheme: 'light' | 'dark'; readonly isColorBlind: boolean };

/** PaintStyle.Stroke; a literal so this module needs no value import from Skia. */
const PAINT_STYLE_STROKE = 1;

export function pickPalette<TToken extends string>(
  set: PaletteSet<TToken>,
  choice: ColorChoice,
): BoardPalette<TToken> {
  if (choice.isColorBlind)
    return choice.scheme === 'dark' ? set.colorBlindDark : set.colorBlindLight;
  return choice.scheme === 'dark' ? set.dark : set.light;
}

/** Resolves every token once per theme change; draw() then reads `colors.color.<token>`. */
export function makeBoardColors<TToken extends string>(
  skia: SkiaApi,
  set: PaletteSet<TToken>,
  choice: ColorChoice,
): BoardColors<TToken> {
  const palette: Readonly<Record<string, string>> = pickPalette(set, choice);
  const color = Object.fromEntries(
    Object.entries(palette).map(([token, hex]): [string, SkColor] => [token, skia.Color(hex)]),
  ) as Record<TToken, SkColor>;
  return { scheme: choice.scheme, isColorBlind: choice.isColorBlind, color };
}

export type KitInput = {
  readonly paths: Readonly<Partial<Record<string, SkPath>>>;
  readonly numberTypeface: SkTypeface | null;
  readonly numberSize: number;
};

export function makeBoardKit(skia: SkiaApi, input: KitInput): RenderKit {
  const fill = skia.Paint();
  fill.setAntiAlias(true);
  const stroke = skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PAINT_STYLE_STROKE);
  const numberFont =
    input.numberTypeface === null ? null : skia.Font(input.numberTypeface, input.numberSize);
  return { fill, stroke, numberFont, paths: input.paths, labels: {} };
}
