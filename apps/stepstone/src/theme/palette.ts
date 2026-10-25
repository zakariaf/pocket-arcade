// apps/stepstone/src/theme/palette.ts
// Written by write-palette.mjs (toybox-design-system skill). Change the paint, then rerun it.
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Light: Lilac pond, Pebble, Toy ink, Pencil, Lily pad, Lotus. */
const LIGHT: ColorTokens = {
  background: '#CFC7F6',
  surface: '#FBFAFF',
  sunken: '#E9E5FC',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#27A776',
  onPrimary: '#1D1B3A',
  pop: '#FF8DB5',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Night pond, Wet stone, Moonlight, Mist, Glow pad, Night lotus. */
const DARK: ColorTokens = {
  background: '#142238',
  surface: '#213452',
  sunken: '#1A2B46',
  text: '#F2F6FF',
  textMuted: '#B3C2E0',
  primary: '#45D6A0',
  onPrimary: '#142238',
  pop: '#FF9DC2',
  onPop: '#142238',
  border: '#DCE6FF',
  shadow: '#050B16',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#F2F6FF',
  starOn: '#FFD23F',
  starOff: '#B3C2E0',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning. */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
