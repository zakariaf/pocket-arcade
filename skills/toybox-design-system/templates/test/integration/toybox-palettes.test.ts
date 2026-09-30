// test/integration/toybox-palettes.test.ts
// One `it` per app: every game's palette passes the Toybox palette rules.
import { PALETTE as LINE_SIEGE } from '@e07/line-siege/theme/palette.ts';
import { checkToyboxPalette } from '@e07/shell/testing/toybox-palette-checks.ts';

describe('Toybox palettes', () => {
  it('keeps Line Siege readable, one-ink in light and colour-blind equal to standard', () => {
    expect(checkToyboxPalette(LINE_SIEGE)).toStrictEqual([]);
  });

  it('catches a palette whose muted text is too faint', () => {
    const faint = { ...LINE_SIEGE.standard.light, textMuted: '#9A98B0' };
    const standard = { ...LINE_SIEGE.standard, light: faint };
    const broken = { standard, colorBlind: standard };
    expect(checkToyboxPalette(broken)).toContain(
      'standard.light: textMuted on background is 1.86:1 < 4.5:1',
    );
  });
});
