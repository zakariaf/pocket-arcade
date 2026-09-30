// packages/shell/src/testing/test-palette.ts
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

const LIGHT: ColorTokens = {
  background: '#FFFFFF',
  surface: '#F2F2F7',
  sunken: '#E5E5EA',
  text: '#1C1C1E',
  textMuted: '#5A5A60',
  primary: '#1F5FBF',
  onPrimary: '#FFFFFF',
  pop: '#FFCC00',
  onPop: '#1C1C1E',
  border: '#8E8E93',
  shadow: '#1C1C1E',
  danger: '#B3261E',
  focus: '#C8157A',
  icon: '#1C1C1E',
  starOn: '#8A5A00',
  starOff: '#6E6E73',
};
const DARK: ColorTokens = {
  background: '#000000',
  surface: '#1C1C1E',
  sunken: '#2C2C2E',
  text: '#F2F2F7',
  textMuted: '#AEAEB2',
  primary: '#6FA8FF',
  onPrimary: '#000000',
  pop: '#FFD60A',
  onPop: '#000000',
  border: '#8E8E93',
  shadow: '#000000',
  danger: '#FF8A80',
  focus: '#FF8AD8',
  icon: '#F2F2F7',
  starOn: '#FFC94D',
  starOff: '#8E8E93',
};

/**
 * Fixture palette for component tests: deliberately NOT a Toybox paint, so a test can never pass
 * because a colour happens to match a game. Real palettes come from each game's theme/palette.ts.
 */
export const TEST_PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
