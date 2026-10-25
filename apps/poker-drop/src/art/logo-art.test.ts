// apps/poker-drop/src/art/logo-art.test.ts
import { LOGO_GRID, logoOps } from '@e07/shell/art/logo-art.ts';

import { LOGO_ART } from './logo-art.ts';

import type { LogoRole } from '@e07/shell/art/logo-art.ts';

const PAINTS = { pop: '#FFD23F', toyInk: '#1D1B3A', white: '#FFFFFF' };
const POP_ROLES: readonly LogoRole[] = ['p', 'pl'];
/** The logo recipe keeps 2 units clear at the edges of the 48 grid. */
const CLEAR = 2;

/** The first point of a layer's path (every layer starts with an absolute move). */
function startOf(d: string): readonly number[] {
  const match = /^M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(d);
  return match === null ? [] : [Number(match[1]), Number(match[2])];
}

describe('LOGO_ART', () => {
  // spec 8.12: each game has its own logo, drawn in code; spec N9: art drawn in code.
  it('has one or two pop accents, and toy-ink edges or details', () => {
    const pops = LOGO_ART.layers.filter((layer) => POP_ROLES.includes(layer.role));
    const colors = new Set(logoOps(LOGO_ART, PAINTS).map((op) => op.color));

    expect(pops.length).toBeGreaterThanOrEqual(1);
    expect(pops.length).toBeLessThanOrEqual(2);
    expect(colors.has(PAINTS.toyInk)).toBe(true);
  });

  it('keeps to the recipe: at most eight layers', () => {
    expect(LOGO_ART.layers.length).toBeGreaterThanOrEqual(1);
    expect(LOGO_ART.layers.length).toBeLessThanOrEqual(8);
  });

  it('starts every layer inside the 48 grid, clear of its edges', () => {
    const outside = LOGO_ART.layers
      .map((layer) => startOf(layer.d))
      .filter(
        (point) =>
          point.length !== 2 || point.some((value) => value < CLEAR || value > LOGO_GRID - CLEAR),
      );

    expect(outside).toStrictEqual([]);
  });
});

describe('Poker Drop LOGO_ART', () => {
  // The Toybox logo (design/toybox/tokens.json logos.games.pokerDrop): two fanned cards under a
  // short drop arrow, the back card in pop, the front one white with an ink spade.
  it('paints the drop arrow, the pop card, the white card, then the spade, the cards fanned', () => {
    expect(LOGO_ART.layers.map((layer) => [layer.role, layer.rotate?.deg ?? 0])).toStrictEqual([
      ['kl', 0],
      ['p', -11],
      ['w', 9],
      ['k', 9],
    ]);
  });
});
