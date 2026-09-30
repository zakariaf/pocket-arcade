// packages/shell/src/testing/palette-checks.ts
import { contrastRatio } from '@e07/shell/theme/contrast.ts';
import { minPairwiseDistance } from '@e07/shell/theme/cvd.ts';

import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

type Pair = readonly [keyof ColorTokens, keyof ColorTokens, number];

/**
 * WCAG 2.2 AA for the Toybox design: 4.5:1 for text (1.4.3), 3:1 for icons, outlines and control
 * shapes (1.4.11). Every Toybox control, tile and star is edged with the ink outline (`border`),
 * so the outline is the boundary 1.4.11 measures; accent, pop and star fills may sit close to
 * the ground by design. Danger text only ever sits on `surface`.
 */
const PAIRS: readonly Pair[] = [
  ['text', 'background', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'sunken', 4.5],
  ['textMuted', 'background', 4.5],
  ['textMuted', 'surface', 4.5],
  ['textMuted', 'sunken', 4.5],
  ['onPrimary', 'primary', 4.5],
  ['onPop', 'pop', 4.5],
  ['danger', 'surface', 4.5],
  ['icon', 'background', 3],
  ['icon', 'surface', 3],
  ['border', 'background', 3],
  ['border', 'surface', 3],
  ['starOff', 'surface', 3],
  ['focus', 'background', 3],
  ['focus', 'sunken', 3],
];
/**
 * A filled shape (accent key, pop key, filled star) must stand 3:1 off its ink edge (light paints)
 * or off what it sits on (dark paints, where the chalk edge is close to the fill).
 */
const FILLS: readonly (readonly [keyof ColorTokens, keyof ColorTokens])[] = [
  ['primary', 'background'],
  ['pop', 'background'],
  ['starOn', 'surface'],
];
/** 3.5 JND in OKLab. Okabe-Ito passes (0.076); red/green sets fail (0.007). */
export const MIN_CVD_DISTANCE = 0.07;

function checkTokens(where: string, tokens: ColorTokens): readonly string[] {
  const pairs = PAIRS.filter(([fg, bg, min]) => contrastRatio(tokens[fg], tokens[bg]) < min).map(
    ([fg, bg, min]) =>
      `${where}: ${fg} on ${bg} is ${contrastRatio(tokens[fg], tokens[bg]).toFixed(2)}:1 < ${String(min)}:1`,
  );
  const fills = FILLS.map(
    ([fill, base]) =>
      [
        fill,
        Math.max(
          contrastRatio(tokens.border, tokens[fill]),
          contrastRatio(tokens[fill], tokens[base]),
        ),
      ] as const,
  )
    .filter(([, best]) => best < 3)
    .map(([fill, best]) => `${where}: ${fill} has no 3:1 edge or ground (${best.toFixed(2)}:1)`);
  return [...pairs, ...fills];
}

/** Returns human-readable failures; an accessible palette returns []. */
export function checkPaletteContrast(palette: Palette): readonly string[] {
  return Object.entries(palette).flatMap(([mode, schemes]) =>
    Object.entries(schemes).flatMap(([scheme, tokens]) => checkTokens(`${mode}.${scheme}`, tokens)),
  );
}

/** Colours that tell game pieces apart must stay apart for protan, deutan and tritan eyes. */
export function checkCategoricalColors(colors: readonly string[]): readonly string[] {
  const deficiencies = ['protanopia', 'deuteranopia', 'tritanopia'] as const;
  return deficiencies
    .map((deficiency) => [deficiency, minPairwiseDistance(colors, deficiency)] as const)
    .filter(([, distance]) => distance < MIN_CVD_DISTANCE)
    .map(
      ([deficiency, distance]) =>
        `${deficiency}: closest pair ${distance.toFixed(3)} < ${String(MIN_CVD_DISTANCE)}`,
    );
}
