// apps/scrap-shove/src/theme/palette.ts
// Written by write-palette.mjs (toybox-design-system skill). Change the paint, then rerun it.
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Light: Hazard lemon, Enamel, Toy ink, Pencil, Robot teal, Rust. */
const LIGHT: ColorTokens = {
  background: '#F7DF7E',
  surface: '#FFFEF8',
  sunken: '#F9EBB2',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#1FB5A9',
  onPrimary: '#1D1B3A',
  pop: '#FF8A3D',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Scrapyard night, Tin, Moonlight, Smoke, Neon teal, Hot rust. */
const DARK: ColorTokens = {
  background: '#261C45',
  surface: '#372A63',
  sunken: '#2E2356',
  text: '#F7F2FF',
  textMuted: '#C4B6EC',
  primary: '#36D1C4',
  onPrimary: '#261C45',
  pop: '#FF9A55',
  onPop: '#261C45',
  border: '#EDE4FF',
  shadow: '#0B0718',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#F7F2FF',
  starOn: '#FFD23F',
  starOff: '#C4B6EC',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning. */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
