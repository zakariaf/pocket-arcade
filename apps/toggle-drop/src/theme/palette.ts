// apps/toggle-drop/src/theme/palette.ts
// Written by write-palette.mjs (toybox-design-system skill). Change the paint, then rerun it.
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Light: Lilac wash, Chalk, Toy ink, Pencil, Bubblegum, Lime ball. */
const LIGHT: ColorTokens = {
  background: '#CEC6F5',
  surface: '#FBFAFF',
  sunken: '#E8E3FB',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#FF7EB0',
  onPrimary: '#1D1B3A',
  pop: '#BDEB5C',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Arcade night, Cabinet, Moonlight, Dusk lilac, Glow gum, Glow lime. */
const DARK: ColorTokens = {
  background: '#1C1636',
  surface: '#2C2454',
  sunken: '#241D45',
  text: '#F5F2FF',
  textMuted: '#BBB0EA',
  primary: '#FF91BD',
  onPrimary: '#1C1636',
  pop: '#C8F26E',
  onPop: '#1C1636',
  border: '#E6E0FF',
  shadow: '#08061A',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#F5F2FF',
  starOn: '#FFD23F',
  starOff: '#BBB0EA',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning. */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
