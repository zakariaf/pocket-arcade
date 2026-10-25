// test/integration/toybox-palettes.test.ts
// One `it` per app: every game's palette passes the Toybox palette rules.
import { PALETTE as FLOCK_TILT } from '@e07/flock-tilt/theme/palette.ts';
import { PALETTE as JUMP_CHAIN } from '@e07/jump-chain/theme/palette.ts';
import { PALETTE as LINE_SIEGE } from '@e07/line-siege/theme/palette.ts';
import { PALETTE as MERGE_SIEGE } from '@e07/merge-siege/theme/palette.ts';
import { PALETTE as SCRAP_SHOVE } from '@e07/scrap-shove/theme/palette.ts';
import { checkToyboxPalette } from '@e07/shell/testing/toybox-palette-checks.ts';
import { PALETTE as SNARE_SNAKE } from '@e07/snare-snake/theme/palette.ts';
import { PALETTE as STEPSTONE } from '@e07/stepstone/theme/palette.ts';

describe('Toybox palettes', () => {
  it('keeps Line Siege readable, one-ink in light and colour-blind equal to standard', () => {
    expect(checkToyboxPalette(LINE_SIEGE)).toStrictEqual([]);
  });

  it('keeps Flock Tilt readable, one-ink in light and colour-blind equal to standard', () => {
    expect(checkToyboxPalette(FLOCK_TILT)).toStrictEqual([]);
  });

  it('keeps Scrap Shove readable, one-ink in light and colour-blind equal to standard', () => {
    expect(checkToyboxPalette(SCRAP_SHOVE)).toStrictEqual([]);
  });

  it('keeps Snare Snake readable, one-ink in light and colour-blind equal to standard', () => {
    expect(checkToyboxPalette(SNARE_SNAKE)).toStrictEqual([]);
  });

  it('keeps Merge Siege readable, one-ink in light and colour-blind equal to standard', () => {
    expect(checkToyboxPalette(MERGE_SIEGE)).toStrictEqual([]);
  });

  it('keeps Jump Chain readable, one-ink in light and colour-blind equal to standard', () => {
    expect(checkToyboxPalette(JUMP_CHAIN)).toStrictEqual([]);
  });

  it('keeps Stepstone readable, one-ink in light and colour-blind equal to standard', () => {
    expect(checkToyboxPalette(STEPSTONE)).toStrictEqual([]);
  });

  // spec 8.11 (O5): every text reaches 4.5:1 against what is behind it, in every state, including
  // the danger label while the hold-to-confirm dangerFill grows under it.
  it('checks the danger and body text on every fill the components draw them on', () => {
    const light = { ...LINE_SIEGE.standard.light, danger: '#D02A40' };
    const dark = { ...LINE_SIEGE.standard.dark, text: '#8E8AB8' };
    const standard = { light, dark };
    const problems = checkToyboxPalette({ standard, colorBlind: standard });
    expect(problems).toContain('standard.light: danger on sunken is 4.19:1 < 4.5:1');
    expect(problems).toContain('standard.light: danger on dangerFill is 4.05:1 < 4.5:1');
    expect(problems).toContain('standard.dark: text on dangerFill is 4.18:1 < 4.5:1');
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
