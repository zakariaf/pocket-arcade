// packages/shell/src/testing/palette-checks.test.ts
import { checkCategoricalColors, checkPaletteContrast } from './palette-checks.ts';

import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Toybox paint for Line Siege (the design's values): the reference an accessible palette meets. */
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
  border: '#E4E0FF',
  shadow: '#07061A',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#F4F2FF',
  starOn: '#FFD23F',
  starOff: '#B9B4EA',
};
const TOYBOX: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};

describe('palette checks', () => {
  it('accepts the Toybox palette in every mode and scheme', () => {
    expect(checkPaletteContrast(TOYBOX)).toStrictEqual([]);
  });

  it('flags grey text that is too light, naming the pair and the ratio', () => {
    const light = { ...LIGHT, textMuted: '#9A9A9A' };
    const palette = { ...TOYBOX, standard: { ...TOYBOX.standard, light } };
    expect(checkPaletteContrast(palette)).toContain(
      'standard.light: textMuted on surface is 2.71:1 < 4.5:1',
    );
  });

  it('flags an outline that no longer separates a control from the ground', () => {
    const dark = { ...DARK, border: '#2E2B66' };
    const palette = { ...TOYBOX, standard: { ...TOYBOX.standard, dark } };
    expect(checkPaletteContrast(palette).join('\n')).toContain('border on background');
  });

  it('flags an accent fill that stands out from neither its outline nor the ground', () => {
    const dark = { ...DARK, border: '#8A86C0', primary: '#55519A' };
    const palette = { ...TOYBOX, standard: { ...TOYBOX.standard, dark } };
    expect(checkPaletteContrast(palette)).toContain(
      'standard.dark: primary has no 3:1 edge or ground (2.39:1)',
    );
  });

  it('accepts Okabe-Ito and rejects a red/green piece set', () => {
    expect(
      checkCategoricalColors(['#E69F00', '#56B4E9', '#009E73', '#0072B2', '#D55E00']),
    ).toStrictEqual([]);
    expect(checkCategoricalColors(['#D62728', '#2CA02C', '#1F77B4', '#FF7F0E'])).not.toStrictEqual(
      [],
    );
  });
});
