// packages/shell/src/game-host/board-kit.test.ts
import { makeBoardColors, makeBoardKit, pickPalette } from './board-kit.ts';

import type { PaletteSet } from './board-kit.ts';
import type { SkiaApi } from './board-types.ts';
import type { SkTypeface } from '@shopify/react-native-skia';

const SET: PaletteSet<'ink'> = {
  light: { ink: '#111111' },
  dark: { ink: '#eeeeee' },
  colorBlindLight: { ink: '#0072b2' },
  colorBlindDark: { ink: '#56b4e9' },
};

type PaintCall = [string, unknown];

/** The few Skia factories the kit calls, recording what it asks for. */
function fakeSkia(): { skia: SkiaApi; paints: PaintCall[][] } {
  const paints: PaintCall[][] = [];
  const color = (hex: string): string => `color(${hex})`;
  const paint = (): unknown => {
    const calls: PaintCall[] = [];
    paints.push(calls);
    return {
      setAntiAlias: (isOn: boolean) => calls.push(['antiAlias', isOn]),
      setStyle: (style: number) => calls.push(['style', style]),
    };
  };
  const font = (typeface: unknown, size: number): unknown => ({ typeface, size });
  // Skia's factory names are PascalCase; the stand-ins are assigned, not declared, under them.
  const skia = { Color: color, Paint: paint, Font: font } as unknown as SkiaApi;
  return { skia, paints };
}

describe('pickPalette', () => {
  it('picks the set for the scheme and the colour-blind switch', () => {
    expect(pickPalette(SET, { scheme: 'light', isColorBlind: false }).ink).toBe('#111111');
    expect(pickPalette(SET, { scheme: 'dark', isColorBlind: false }).ink).toBe('#eeeeee');
    expect(pickPalette(SET, { scheme: 'light', isColorBlind: true }).ink).toBe('#0072b2');
    expect(pickPalette(SET, { scheme: 'dark', isColorBlind: true }).ink).toBe('#56b4e9');
  });
});

describe('makeBoardColors', () => {
  it('resolves every token of the chosen set once', () => {
    const { skia } = fakeSkia();
    const colors = makeBoardColors(skia, SET, { scheme: 'dark', isColorBlind: true });
    expect(colors).toStrictEqual({
      scheme: 'dark',
      isColorBlind: true,
      color: { ink: 'color(#56b4e9)' },
    });
  });
});

describe('makeBoardKit', () => {
  it('builds one anti-aliased fill, one stroke and the number font', () => {
    const { skia, paints } = fakeSkia();
    const typeface = { name: 'Vazirmatn' } as unknown as SkTypeface;
    const kit = makeBoardKit(skia, { paths: {}, numberTypeface: typeface, numberSize: 18 });
    expect(paints).toStrictEqual([
      [['antiAlias', true]],
      [
        ['antiAlias', true],
        ['style', 1],
      ],
    ]);
    expect(kit.numberFont).toStrictEqual({ typeface, size: 18 });
    expect(kit.labels).toStrictEqual({});
  });

  it('has no number font without a typeface', () => {
    const { skia } = fakeSkia();
    expect(
      makeBoardKit(skia, { paths: {}, numberTypeface: null, numberSize: 18 }).numberFont,
    ).toBeNull();
  });
});
