// apps/swap-guard/src/theme/palette.ts
// Written by write-palette.mjs (toybox-design-system skill). Change the paint, then rerun it.
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Light: Castle lilac, Parchment, Toy ink, Pencil, Shield blue, Torch orange. */
const LIGHT: ColorTokens = {
  background: '#CCC0F4',
  surface: '#FBF9FF',
  sunken: '#EAE4FC',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#5C9DFF',
  onPrimary: '#1D1B3A',
  pop: '#FFA94D',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Castle night, Battlement, Moonlight, Dusk lilac, Glow shield, Torch flame. */
const DARK: ColorTokens = {
  background: '#2A1838',
  surface: '#3D2552',
  sunken: '#331E45',
  text: '#FBF2FF',
  textMuted: '#D7BCEB',
  primary: '#7FB4FF',
  onPrimary: '#2A1838',
  pop: '#FFB463',
  onPop: '#2A1838',
  border: '#F2E2FF',
  shadow: '#10061A',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#FBF2FF',
  starOn: '#FFD23F',
  starOff: '#D7BCEB',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning. */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
