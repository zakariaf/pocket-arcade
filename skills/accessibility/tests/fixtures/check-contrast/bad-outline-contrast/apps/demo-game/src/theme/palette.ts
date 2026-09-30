// apps/demo-game/src/theme/palette.ts
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Toybox paint for Line Siege, light: Sky wash, Chalk, Toy ink, Pencil, Brick tomato, Sunshine. */
const LIGHT: ColorTokens = {
  background: '#A5DAF3',
  surface: '#F8FBFF',
  sunken: '#D3ECF8',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#FF6B4A',
  onPrimary: '#1D1B3A',
  pop: '#FFD23F',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Toy chest, Lid, Moonlight, Dusk, Ember, Lantern. */
const DARK: ColorTokens = {
  background: '#1B1943',
  surface: '#2B2862',
  sunken: '#221F52',
  text: '#F4F2FF',
  textMuted: '#B9B4EA',
  primary: '#FF7D5E',
  onPrimary: '#1B1943',
  pop: '#FFD84D',
  onPop: '#1B1943',
  border: '#2E2B66',
  shadow: '#07061A',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#F4F2FF',
  starOn: '#FFD23F',
  starOff: '#B9B4EA',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning (doc 18). */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
