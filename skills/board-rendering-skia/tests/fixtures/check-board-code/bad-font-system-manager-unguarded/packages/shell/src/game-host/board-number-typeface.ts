// packages/shell/src/game-host/board-number-typeface.ts
// Planted bug: the fallback file asks the system font manager on every platform (no iOS guard).
import type { SkiaApi } from './board-types.ts';
import type { SkTypeface } from '@shopify/react-native-skia';

export function boardNumberFaceOf(skia: SkiaApi, bundled: SkTypeface | null): SkTypeface | null {
  if (bundled !== null) return bundled;
  return skia.FontMgr.System().matchFamilyStyle('Vazirmatn', { weight: 400, width: 5, slant: 0 });
}
