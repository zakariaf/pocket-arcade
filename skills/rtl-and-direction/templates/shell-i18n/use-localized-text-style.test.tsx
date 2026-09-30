// packages/shell/src/i18n/use-localized-text-style.test.tsx
import { renderHook } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { TEXT_ALIGN, snapToPixels, useLocalizedTextStyle } from './use-localized-text-style.ts';

import type { Language } from './languages.ts';
import type { LocalizedTextOptions } from './use-localized-text-style.ts';
import type { TextStyle } from 'react-native';

const ROW_LABEL: LocalizedTextOptions = {
  fontSize: 17,
  weight: 'regular',
  align: 'start',
  lineHeight: { latin: 1.32, arabic: 1.5 },
};

async function styleIn(language: Language, options: LocalizedTextOptions): Promise<TextStyle> {
  const { wrapper } = createShellWrapper({ language });
  const { result } = await renderHook(() => useLocalizedTextStyle(options), { wrapper });
  return result.current;
}

describe('snapToPixels', () => {
  it('puts a Toybox line height on the nearest device pixel (3x), never on whole points', () => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);

    expect(snapToPixels(18.2)).toBe(55 / 3); // 14 x 1.3
    expect(snapToPixels(22.44)).toBe(67 / 3); // 17 x 1.32
    expect(snapToPixels(25.5)).toBe(77 / 3); // 17 x 1.5 (whole points would give 26)
  });

  it('keeps a value that is already on the grid (2x)', () => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(2);

    expect(snapToPixels(25.5)).toBe(25.5);
    expect(snapToPixels(18.2)).toBe(18);
  });
});

describe('useLocalizedTextStyle', () => {
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  });

  it('sets Latin text in Rubik with the snapped Latin line height, left to right', async () => {
    const style = await styleIn('en', ROW_LABEL);

    expect(style).toStrictEqual({
      fontFamily: 'Rubik-Regular',
      fontSize: 17,
      lineHeight: 67 / 3,
      writingDirection: 'ltr',
      textAlign: TEXT_ALIGN.start,
    });
  });

  it('sets Persian text in Vazirmatn with the snapped Arabic-script line height, right to left', async () => {
    const style = await styleIn('fa', { ...ROW_LABEL, align: 'end' });

    expect(style).toStrictEqual({
      fontFamily: 'Vazirmatn-Regular',
      fontSize: 17,
      lineHeight: 77 / 3,
      writingDirection: 'rtl',
      textAlign: TEXT_ALIGN.end,
    });
  });

  it('tracks the game name in Latin script only', async () => {
    const brand: LocalizedTextOptions = {
      fontSize: 28,
      weight: 'bold',
      align: 'start',
      face: 'brand',
      lineHeight: { latin: 1.05, arabic: 1.05 },
      letterSpacingEm: 0.01,
    };

    expect((await styleIn('en', brand)).letterSpacing).toBeCloseTo(0.28);
    expect(await styleIn('fa', { ...brand, face: 'text' })).not.toHaveProperty('letterSpacing');
  });

  it('uses the face defaults when the style gives no ratios', async () => {
    const style = await styleIn('en', { fontSize: 14, weight: 'bold', align: 'center' });

    // text face default 1.32: 14 x 1.32 = 18.48 -> 55/3 on the 3x grid.
    expect(style).toMatchObject({ fontFamily: 'Rubik-Bold', lineHeight: 55 / 3 });
  });
});
