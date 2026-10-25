// apps/merge-siege/src/theme/palette.ts
// Written by write-palette.mjs (toybox-design-system skill). Change the paint, then rerun it.
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Light: Peach wash, Cream, Grape, Mint. */
const LIGHT: ColorTokens = {
  background: '#FFD6B8',
  surface: '#FFFBF7',
  sunken: '#FFE8D7',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#A98BFF',
  onPrimary: '#1D1B3A',
  pop: '#63DDB0',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Plum night, Plum lid, Moonlight, Lavender dusk, Glow grape, Glow mint. */
const DARK: ColorTokens = {
  background: '#2B1838',
  surface: '#3F2550',
  sunken: '#351E44',
  text: '#FBF4FF',
  textMuted: '#B49CC8',
  primary: '#B9A0FF',
  onPrimary: '#2B1838',
  pop: '#74EBC0',
  onPop: '#2B1838',
  border: '#F1E4FF',
  shadow: '#0E0614',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#FBF4FF',
  starOn: '#FFD23F',
  starOff: '#B49CC8',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning. */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
