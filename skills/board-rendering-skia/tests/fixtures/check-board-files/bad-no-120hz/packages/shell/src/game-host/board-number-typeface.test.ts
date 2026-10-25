// packages/shell/src/game-host/board-number-typeface.test.ts
import { boardNumberFaceOf, onceFound } from './board-number-typeface.ts';

import type { SkiaApi } from './board-types.ts';
import type { SkTypeface } from '@shopify/react-native-skia';

const BUNDLED = { kind: 'bundled' } as unknown as SkTypeface;
const SYSTEM = { kind: 'system' } as unknown as SkTypeface;

/** A Skia whose bytes make BUNDLED and whose system font manager answers `system` for Vazirmatn. */
function fakeSkia(system: SkTypeface | null): { skia: SkiaApi; asked: unknown[] } {
  const asked: unknown[] = [];
  const systemManager = (): unknown => ({
    matchFamilyStyle: (family: string, style: unknown) => {
      asked.push({ family, style });
      return system;
    },
  });
  const makeFace = (): SkTypeface => BUNDLED;
  // Skia's factory names are PascalCase; the stand-ins are assigned, not declared, under them.
  const skia = {
    FontMgr: { System: systemManager },
    Data: { fromBytes: (bytes: Uint8Array) => ({ bytes }) },
    Typeface: { MakeFreeTypeFaceFromData: makeFace },
  } as unknown as SkiaApi;
  return { skia, asked };
}

const BYTES = new Uint8Array([0, 1, 0, 0, 7]);

describe('boardNumberFaceOf', () => {
  it('makes the digits face from the bundled bytes first, on iOS and Android alike', () => {
    // Spec 7.x fonts: board numbers use the bundled Vazirmatn (S5 board, monster health pills).
    const { skia, asked } = fakeSkia(SYSTEM);
    expect(boardNumberFaceOf(skia, () => BYTES, 'ios')).toBe(BUNDLED);
    expect(boardNumberFaceOf(skia, () => BYTES, 'android')).toBe(BUNDLED);
    expect(asked).toStrictEqual([]);
  });

  it("falls back on iOS to the system font manager, which sees the app's own fonts", () => {
    // Without the BoardFont module (or its bytes) iOS still draws digits: CoreText sees the
    // fonts the expo-font plugin embeds, as the board did before the bundled-bytes path.
    const { skia, asked } = fakeSkia(SYSTEM);
    expect(boardNumberFaceOf(skia, () => null, 'ios')).toBe(SYSTEM);
    expect(asked).toStrictEqual([
      { family: 'Vazirmatn', style: { weight: 400, width: 5, slant: 0 } },
    ]);
  });

  it('keeps Android off the fallback: its font manager answers an app font with an empty face', () => {
    const { skia, asked } = fakeSkia(SYSTEM);
    expect(boardNumberFaceOf(skia, () => null, 'android')).toBeNull();
    expect(asked).toStrictEqual([]);
  });
});

describe('onceFound', () => {
  it('makes the face once it is found, and tries again while none was found', () => {
    const answers: (SkTypeface | null)[] = [null, BUNDLED, SYSTEM];
    let calls = 0;
    const face = onceFound(() => {
      calls += 1;
      return answers.shift() ?? null;
    });
    expect([face(), face(), face(), calls]).toStrictEqual([null, BUNDLED, BUNDLED, 2]);
  });
});
