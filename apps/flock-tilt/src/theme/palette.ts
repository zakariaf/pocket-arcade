// apps/flock-tilt/src/theme/palette.ts
// Written by write-palette.mjs (toybox-design-system skill). Change the paint, then rerun it.
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Light: Meadow wash, Fleece, Toy ink, Pencil, Clover, Pond. */
const LIGHT: ColorTokens = {
  background: '#AEE8C6',
  surface: '#F7FCF9',
  sunken: '#D2F1DF',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#3DBE66',
  onPrimary: '#1D1B3A',
  pop: '#7CC8FF',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Night field, Barn roof, Moonlight, Mist, Glow clover, Moon pond. */
const DARK: ColorTokens = {
  background: '#112A48',
  surface: '#1C3C62',
  sunken: '#15325A',
  text: '#F2F7FF',
  textMuted: '#AFC6E6',
  primary: '#52D67F',
  onPrimary: '#112A48',
  pop: '#86CFFF',
  onPop: '#112A48',
  border: '#DCEBFF',
  shadow: '#050E1C',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#F2F7FF',
  starOn: '#FFD23F',
  starOff: '#AFC6E6',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning. */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
