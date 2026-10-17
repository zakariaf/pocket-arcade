// packages/shell/src/ui/use-scaled-size.ts
import { Platform, useWindowDimensions } from 'react-native';

import { isCurvedScalingOn, scaledSizeOf } from './font-scale-curve.ts';

/**
 * The size the phone draws a text size or line height at, for the phone's text size (spec 8.11):
 * linear up to 200 % on iOS and Android before 14, along AOSP's font scale curves on Android 14
 * and later (font-scale-curve.ts). A part laid out against a text line (AppText's room, the quiet
 * underline) grows with it.
 */
export function useScaledSize(): (size: number) => number {
  const { fontScale } = useWindowDimensions();
  const isCurved = isCurvedScalingOn(Platform.OS, Platform.Version);
  return (size) => scaledSizeOf(size, fontScale, isCurved);
}
