// apps/trail-clear/src/theme/palette.ts
// Written by write-palette.mjs (toybox-design-system skill). Change the paint, then rerun it.
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Light: Trail sand, Map paper, Toy ink, Pencil, River blue, Moss. */
const LIGHT: ColorTokens = {
  background: '#F3D6A4',
  surface: '#FFFBF3',
  sunken: '#F9E8CB',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#4FA8F0',
  onPrimary: '#1D1B3A',
  pop: '#A9DC6E',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Campfire night, Map case, Moonlight, Dusk sand, Glow river, Glow moss. */
const DARK: ColorTokens = {
  background: '#2B2030',
  surface: '#3E3045',
  sunken: '#34283A',
  text: '#FFF6EC',
  textMuted: '#B49A86',
  primary: '#5BBCF5',
  onPrimary: '#2B2030',
  pop: '#B5E57C',
  onPop: '#2B2030',
  border: '#FFE9CF',
  shadow: '#0E0910',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#FFF6EC',
  starOn: '#FFD23F',
  starOff: '#B49A86',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning. */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
