// packages/shell/src/ui/use-text-scale.ts
import { useWindowDimensions } from 'react-native';

/** Text grows with Dynamic Type up to 200 % and no further (spec 8.11): maxFontSizeMultiplier. */
export const MAX_TEXT_SCALE = 2;

/**
 * The factor iOS draws text at: the phone's text size, capped at 200 %. React Native scales the
 * font size and the line height by it, so a part measured against a text line scales with it.
 */
export function useTextScale(): number {
  return Math.min(useWindowDimensions().fontScale, MAX_TEXT_SCALE);
}
