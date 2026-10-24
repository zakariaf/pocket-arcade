// packages/shell/src/game-host/create-example-picture.tsx
// device-only: covered by the S13 How to play screen on the simulator.
import { Skia } from '@shopify/react-native-skia';

const NUMBER_FAMILY = 'Vazirmatn';
const NUMBER_STYLE = { weight: 400, width: 5, slant: 0 } as const;

/** Planted bug: the system font manager cannot see the app's Vazirmatn on Android. */
export function numberTypeface() {
  return Skia.FontMgr.System().matchFamilyStyle(NUMBER_FAMILY, NUMBER_STYLE);
}
