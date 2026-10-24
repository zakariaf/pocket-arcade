// packages/shell/src/game-host/board-number-font.ts
// device-only: covered by the simulator and emulator board screenshots (the monster health digits); the face rule is board-number-typeface.android.test.ts
import { Skia } from '@shopify/react-native-skia';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { boardNumberFaceOf, bundledFontReaderOf, onceFound } from './board-number-typeface.ts';

import type { BoardFontModule } from './board-number-typeface.ts';

// Native side: packages/shell/ios/BoardFontModule.swift (the app bundle) and
// packages/shell/android/.../BoardFontModule.kt (the APK's assets/fonts/).
const nativeModule = requireOptionalNativeModule<BoardFontModule>('BoardFont');

/**
 * The board's digits face, made on the JS thread when the first board or S13 picture is drawn
 * (never at boot), from the bundled TTF's bytes: the same face on iOS and Android, with iOS's
 * system font manager as the fallback. Kept once found; a miss is tried again on the next board.
 */
export const boardNumberTypeface = onceFound(() =>
  boardNumberFaceOf(Skia, bundledFontReaderOf(nativeModule), Platform.OS),
);
