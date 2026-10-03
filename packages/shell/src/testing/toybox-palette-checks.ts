// packages/shell/src/testing/toybox-palette-checks.ts
import { contrastRatio } from '@e07/shell/theme/contrast.ts';

import type { ColorScheme, ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

type Token = keyof ColorTokens;
type Pair = readonly [Token, Token, number];

/** WCAG 2.2 AA where Toybox puts text (4.5:1) and its outlines, focus ring and hollow stars (3:1). */
const PAIRS: readonly Pair[] = [
  ['text', 'background', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'sunken', 4.5],
  ['textMuted', 'background', 4.5],
  ['textMuted', 'surface', 4.5],
  ['textMuted', 'sunken', 4.5],
  ['onPrimary', 'primary', 4.5],
  ['onPop', 'pop', 4.5],
  // Danger text sits only on surface in Toybox (on the light ground it would fail).
  ['danger', 'surface', 4.5],
  ['border', 'background', 3],
  ['border', 'surface', 3],
  ['focus', 'background', 3],
  ['focus', 'sunken', 3],
  ['starOff', 'surface', 3],
];

/** A filled shape must stand 3:1 off its ink edge (light paints) or off what it sits on (dark). */
const FILLS: readonly (readonly [Token, Token])[] = [
  ['primary', 'background'],
  ['pop', 'background'],
  ['starOn', 'surface'],
];

/** Light Toybox is "one ink": these fields are toy ink or pencil in every game. */
const LIGHT_INK: Readonly<Partial<Record<Token, string>>> = {
  text: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  onPrimary: '#1D1B3A',
  onPop: '#1D1B3A',
  icon: '#1D1B3A',
  textMuted: '#43406A',
  starOff: '#43406A',
};

const ratio = (a: string, b: string): number => contrastRatio(a, b);
const fixed = (value: number): string => value.toFixed(2);

function contrastProblems(where: string, tokens: ColorTokens): string[] {
  const problems = PAIRS.filter(([fg, bg, min]) => ratio(tokens[fg], tokens[bg]) < min).map(
    ([fg, bg, min]) =>
      `${where}: ${fg} on ${bg} is ${fixed(ratio(tokens[fg], tokens[bg]))}:1 < ${String(min)}:1`,
  );
  for (const [fill, base] of FILLS) {
    const best = Math.max(ratio(tokens.border, tokens[fill]), ratio(tokens[fill], tokens[base]));
    if (best < 3) problems.push(`${where}: ${fill} has no 3:1 edge or ground (${fixed(best)}:1)`);
  }
  return problems;
}

function inkProblems(scheme: ColorScheme, tokens: ColorTokens): string[] {
  if (scheme === 'dark') return [];
  return Object.entries(LIGHT_INK)
    .filter(([field, hex]) => tokens[field as Token] !== hex)
    .map(([field, hex]) => `standard.light: ${field} must be the one ink ${hex}`);
}

/** Toybox palette rules; an app palette returns []. */
export function checkToyboxPalette(palette: Palette): readonly string[] {
  const problems: string[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    const tokens = palette.standard[scheme];
    problems.push(...contrastProblems(`standard.${scheme}`, tokens));
    problems.push(...inkProblems(scheme, tokens));
    if (palette.colorBlind[scheme] !== tokens) {
      problems.push(`colorBlind.${scheme}: must be the same object as standard.${scheme}`);
    }
  }
  return problems;
}
