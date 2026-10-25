// apps/poker-drop/src/theme/palette.ts
// Written by write-palette.mjs (toybox-design-system skill). Change the paint, then rerun it.
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Light: Velvet wash, Card stock, Toy ink, Pencil, Ruby, Felt. */
const LIGHT: ColorTokens = {
  background: '#CDBDF4',
  surface: '#FCFAFF',
  sunken: '#EAE3FB',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#FF5C7A',
  onPrimary: '#1D1B3A',
  pop: '#4CD08A',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Velvet night, Card box, Moonlight, Lavender, Glow ruby, Night felt. */
const DARK: ColorTokens = {
  background: '#1E1640',
  surface: '#2E2460',
  sunken: '#261D50',
  text: '#F6F2FF',
  textMuted: '#C3B8F0',
  primary: '#FF7690',
  onPrimary: '#1E1640',
  pop: '#5EE09B',
  onPop: '#1E1640',
  border: '#E9E2FF',
  shadow: '#090616',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#F6F2FF',
  starOn: '#FFD23F',
  starOff: '#C3B8F0',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning. */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
