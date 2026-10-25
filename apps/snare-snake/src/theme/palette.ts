// apps/snare-snake/src/theme/palette.ts
// Written by write-palette.mjs (toybox-design-system skill). Change the paint, then rerun it.
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Light: Lilac wash, Petal, Toy ink, Pencil, Snake green, Berry. */
const LIGHT: ColorTokens = {
  background: '#C9B8F0',
  surface: '#FCFAFF',
  sunken: '#EAE3FB',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#3FA34D',
  onPrimary: '#1D1B3A',
  pop: '#FF6F9F',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Jungle night, Fern, Moonlight, Mist, Glow green, Glow berry. */
const DARK: ColorTokens = {
  background: '#10302B',
  surface: '#173E36',
  sunken: '#14372F',
  text: '#F0FFF9',
  textMuted: '#8FBFAE',
  primary: '#6CCB5F',
  onPrimary: '#10302B',
  pop: '#FF8DB8',
  onPop: '#10302B',
  border: '#D4F7EA',
  shadow: '#04120F',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#F0FFF9',
  starOn: '#FFD23F',
  starOff: '#8FBFAE',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning. */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
