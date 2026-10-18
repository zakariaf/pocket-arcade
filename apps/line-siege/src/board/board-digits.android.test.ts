// apps/line-siege/src/board/board-digits.android.test.ts
import { Platform } from 'react-native';

import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { LINE_SIEGE_TEACHING } from '@e07/line-siege/tutorial/line-siege-teaching.ts';
import { makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { boardNumberTypefaceOf } from '@e07/shell/game-host/board-number-typeface.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { BoardColors, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkColor } from '@shopify/react-native-skia';

const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const COLORS = {
  scheme: 'light',
  isColorBlind: false,
  color: new Proxy({}, { get: () => COLOR }),
} as BoardColors<BoardToken>;
const BUNDLED_BYTES = new Uint8Array([0, 1, 0, 0]);

type FakeFont = { readonly face: unknown };

/** Android's Skia: the system font manager only knows the phone's own fonts (an empty face). */
function androidSkia(): SkiaApi {
  const paint = (): unknown => new Proxy({}, { get: () => () => undefined });
  const font = (face: unknown): unknown => ({
    face,
    getGlyphIDs: (text: string) => Array.from({ length: text.length }, () => 7),
    getGlyphWidths: (ids: readonly number[]) => ids.map(() => 9),
    getSize: () => 18,
  });
  const systemManager = (): unknown => ({ matchFamilyStyle: () => ({ face: 'empty' }) });
  const makeFace = (data: unknown): unknown => ({ face: 'bundled', data });
  return {
    Paint: paint,
    Font: font,
    FontMgr: { System: systemManager },
    Data: { fromBytes: (bytes: Uint8Array) => ({ bytes }) },
    Typeface: { MakeFreeTypeFaceFromData: makeFace },
  } as unknown as SkiaApi;
}

/** Every drawText call: the text and the face of the font it was drawn with. */
function drawnTexts(draw: (canvas: SkCanvas) => void): { text: string; face: unknown }[] {
  const texts: { text: string; face: unknown }[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          if (name !== 'drawText') return;
          const [text, , , , font] = args as [string, number, number, unknown, FakeFont];
          texts.push({ text, face: font.face });
        },
    },
  ) as SkCanvas;
  draw(canvas);
  return texts;
}

describe('the Line Siege board on Android', () => {
  it("draws every monster's health in the bundled face on the tutorial's first board", () => {
    // Spec S5 and line-siege-rules: each monster shows its health on its pill. The Android test
    // build (Pixel 8 profile, API 35) drew the pills blank while iOS showed 4, 3 and 6: the face
    // came from Skia's system font manager, which on Android has no Vazirmatn (2026-10-18).
    expect(Platform.OS).toBe('android');
    const skia = androidSkia();
    const kit = makeBoardKit(skia, {
      paths: {},
      numberTypeface: boardNumberTypefaceOf(skia, () => BUNDLED_BYTES),
      numberSize: 18,
    });
    const view = toView(LINE_SIEGE_TEACHING.tutorial.start, { formatNumber: String });
    const layout = layoutBoard({ width: 402, height: 560, view, isMirrored: false });
    const fx = { ...sampleTimeline([], 0), pointer: IDLE_POINTER };
    const frame = { view, fx, highlight: EMPTY_HIGHLIGHT, colors: COLORS, layout, kit };
    const bundled = { face: 'bundled', data: { bytes: BUNDLED_BYTES } };
    const drawn = drawnTexts((canvas) => {
      drawBoard(canvas, frame);
    }).toSorted((left, right) => left.text.localeCompare(right.text));
    expect(drawn).toStrictEqual([
      { text: '3', face: bundled },
      { text: '4', face: bundled },
      { text: '6', face: bundled },
    ]);
  });
});
