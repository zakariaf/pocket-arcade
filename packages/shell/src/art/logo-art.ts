// packages/shell/src/art/logo-art.ts
// Toybox game logos: multi-colour line art on a 48-unit grid, drawn in code (never an image file),
// shown at 88 % of the logo tile and never mirrored. Each game exports its LOGO_ART data.

export const LOGO_GRID = 48;

/**
 * p  = pop fill + toy-ink edge 2.6 (round join)   w  = white fill + toy-ink edge 2.6 (round join)
 * w0 = white fill                                   k  = toy-ink fill
 * kl = toy-ink line 2.6 (round cap and join)        pl = pop line 4 (round cap)
 */
export type LogoRole = 'p' | 'w' | 'w0' | 'k' | 'kl' | 'pl';
/** Rotation in degrees about (cx, cy) on the 48 grid, like SVG rotate(deg cx cy). */
export type LogoRotation = { readonly deg: number; readonly cx: number; readonly cy: number };
export type LogoLayer = {
  readonly role: LogoRole;
  readonly d: string;
  readonly rotate?: LogoRotation;
};
export type LogoArt = { readonly layers: readonly LogoLayer[] };

/** Toy ink and white are printed colours (fixed in both schemes); pop is the game's paint. */
export type LogoPaints = { readonly pop: string; readonly toyInk: string; readonly white: string };

export type LogoOp = {
  readonly d: string;
  readonly style: 'fill' | 'stroke';
  readonly color: string;
  readonly width: number;
  readonly cap: 'butt' | 'round';
  readonly rotate?: LogoRotation;
};

const EDGE = 2.6;
const POP_LINE = 4;

function roleOps(role: LogoRole, paints: LogoPaints): readonly Omit<LogoOp, 'd' | 'rotate'>[] {
  const fill = (color: string): Omit<LogoOp, 'd' | 'rotate'> => ({
    style: 'fill',
    color,
    width: 0,
    cap: 'butt',
  });
  const edge = { style: 'stroke', color: paints.toyInk, width: EDGE, cap: 'butt' } as const;
  switch (role) {
    case 'p':
      return [fill(paints.pop), edge];
    case 'w':
      return [fill(paints.white), edge];
    case 'w0':
      return [fill(paints.white)];
    case 'k':
      return [fill(paints.toyInk)];
    case 'kl':
      return [{ ...edge, cap: 'round' }];
    case 'pl':
      return [{ style: 'stroke', color: paints.pop, width: POP_LINE, cap: 'round' }];
  }
}

/** Expands the logo's layers into paint operations in draw order (a fill before its edge). */
export function logoOps(logo: LogoArt, paints: LogoPaints): readonly LogoOp[] {
  return logo.layers.flatMap((layer) =>
    roleOps(layer.role, paints).map((op) => ({
      ...op,
      d: layer.d,
      ...(layer.rotate === undefined ? {} : { rotate: layer.rotate }),
    })),
  );
}
