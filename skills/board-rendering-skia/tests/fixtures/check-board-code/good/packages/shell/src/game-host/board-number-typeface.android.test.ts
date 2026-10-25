// packages/shell/src/game-host/board-number-typeface.android.test.ts
import { Platform } from 'react-native';

import { androidSkia } from '@e07/shell/game-host/testing/android-skia.ts';

import {
  BOARD_NUMBER_FONT_FILE,
  boardNumberTypefaceOf,
  bundledFontReaderOf,
} from './board-number-typeface.ts';

const BYTES = new Uint8Array([0, 1, 0, 0, 7]);

describe('the board number typeface on Android', () => {
  it('makes the digits face from the bundled font, which the system font manager cannot see', () => {
    // Spec 7.x fonts: every number on the board uses the bundled Vazirmatn (S5 board, the monster
    // health pills). Android's Skia font manager reads only /system/fonts and answered 'Vazirmatn'
    // with an empty face, so every monster pill was blank on the Pixel 8 profile (2026-10-18).
    expect(Platform.OS).toBe('android');
    const { skia, made } = androidSkia();
    const read: string[] = [];
    const typeface = boardNumberTypefaceOf(skia, (fileName) => {
      read.push(fileName);
      return BYTES;
    });
    expect({ read, made, typeface }).toStrictEqual({
      read: ['Vazirmatn-Regular.ttf'],
      made: [{ bytes: BYTES }],
      typeface: { kind: 'bundled', data: { bytes: BYTES } },
    });
  });

  it('has no face when the app bundles no such font, instead of drawing with an empty one', () => {
    const { skia, made } = androidSkia();
    expect([boardNumberTypefaceOf(skia, () => null), made]).toStrictEqual([null, []]);
    expect(boardNumberTypefaceOf(skia, () => new Uint8Array())).toBeNull();
  });

  it('reads the font file through the BoardFont native module, null without the module', () => {
    const asked: string[] = [];
    const module = {
      readFontBytes: (fileName: string) => {
        asked.push(fileName);
        return BYTES;
      },
    };
    expect(bundledFontReaderOf(module)(BOARD_NUMBER_FONT_FILE)).toBe(BYTES);
    expect(asked).toStrictEqual(['Vazirmatn-Regular.ttf']);
    expect(bundledFontReaderOf(null)(BOARD_NUMBER_FONT_FILE)).toBeNull();
  });
});
