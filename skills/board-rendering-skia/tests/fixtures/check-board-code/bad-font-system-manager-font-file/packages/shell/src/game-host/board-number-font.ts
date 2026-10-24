// packages/shell/src/game-host/board-number-font.ts
// Planted bug: the system font manager asked outside board-number-typeface.ts's iOS fallback.
import { Skia } from '@shopify/react-native-skia';

import type { SkTypeface } from '@shopify/react-native-skia';

export function boardNumberTypeface(os: string): SkTypeface | null {
  if (os !== 'ios') return null;
  return Skia.FontMgr.System().matchFamilyStyle('Vazirmatn', { weight: 400, width: 5, slant: 0 });
}
