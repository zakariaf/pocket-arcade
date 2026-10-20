// apps/jump-chain/src/theme/palette.ts
// Written by write-palette.mjs (toybox-design-system skill). Change the paint, then rerun it.
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Light: Peach wash, Porcelain, Toy ink, Pencil, Checker red, Crown lilac. */
const LIGHT: ColorTokens = {
  background: '#FFCDB2',
  surface: '#FFF9F4',
  sunken: '#FFE3D3',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#FF5A5F',
  onPrimary: '#1D1B3A',
  pop: '#A996FF',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Cocoa night, Cocoa lid, Moonlight, Rose dusk, Glow red, Night lilac. */
const DARK: ColorTokens = {
  background: '#2B1820',
  surface: '#3F2632',
  sunken: '#351F29',
  text: '#FFF3F0',
  textMuted: '#E8BFC8',
  primary: '#FF7076',
  onPrimary: '#2B1820',
  pop: '#B9A8FF',
  onPop: '#2B1820',
  border: '#FFE0E6',
  shadow: '#12070C',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#FFF3F0',
  starOn: '#FFD23F',
  starOff: '#E8BFC8',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning. */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
