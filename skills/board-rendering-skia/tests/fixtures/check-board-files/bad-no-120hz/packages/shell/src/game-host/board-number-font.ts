// packages/shell/src/game-host/board-number-font.ts
// device-only: covered by the simulator and emulator board screenshots (the monster health digits); the face rule is board-number-typeface.android.test.ts
import { Skia } from '@shopify/react-native-skia';
import { requireOptionalNativeModule } from 'expo';

import { boardNumberTypefaceOf, bundledFontReaderOf } from './board-number-typeface.ts';

import type { BoardFontModule } from './board-number-typeface.ts';
import type { SkTypeface } from '@shopify/react-native-skia';

// Native side: packages/shell/ios/BoardFontModule.swift (the app bundle) and
// packages/shell/android/.../BoardFontModule.kt (the APK's assets/fonts/).
const nativeModule = requireOptionalNativeModule<BoardFontModule>('BoardFont');

let loaded: { readonly face: SkTypeface | null } | null = null;

/**
 * The board's digits face, made once per app on the JS thread when the first board or S13 picture
 * is drawn (never at boot), from the bundled TTF's bytes: the same face on iOS and Android.
 */
export function boardNumberTypeface(): SkTypeface | null {
  loaded ??= { face: boardNumberTypefaceOf(Skia, bundledFontReaderOf(nativeModule)) };
  return loaded.face;
}
