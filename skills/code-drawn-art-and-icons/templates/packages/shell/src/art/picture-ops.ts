// packages/shell/src/art/picture-ops.ts
// Shell pictures drawn in code as plain paint operations (Skia draws them; tests read them):
// the S10 empty-statistics picture and the S15 hazard strip.
import type { ColorTokens } from '@e07/shell/theme/theme-types.ts';

export type PictureOp = {
  readonly d: string;
  readonly style: 'fill' | 'stroke';
  readonly color: string;
  readonly width: number;
  readonly cap: 'butt' | 'round';
  readonly join: 'miter' | 'round';
  /** Dash on/off lengths, for the dashed star. */
  readonly dash?: readonly [number, number];
  /** Rotation in degrees about (cx, cy), like SVG rotate(deg cx cy). */
  readonly rotate?: { readonly deg: number; readonly cx: number; readonly cy: number };
};

/** The empty-statistics picture: viewBox 0 0 190 150, drawn 190 pt wide. */
export const EMPTY_STATS_VIEWBOX = { width: 190, height: 150 } as const;

type Paint = Omit<PictureOp, 'd'>;
const fill = (color: string): Paint => ({
  style: 'fill',
  color,
  width: 0,
  cap: 'butt',
  join: 'miter',
});
const stroke = (color: string, width: number, join: Paint['join'] = 'miter'): Paint => ({
  style: 'stroke',
  color,
  width,
  cap: 'round',
  join,
});

const LID = 'M34 66 48 24 150 36 142 74z';
const STAR = 'M95 33l5.5 11.2 12.3 1.8-8.9 8.7 2.1 12.2L95 60.1l-11 5.8 2.1-12.2-8.9-8.7 12.3-1.8z';
const BOX =
  'M40 68H150A10 10 0 0 1 160 78V130A10 10 0 0 1 150 140H40A10 10 0 0 1 30 130V78A10 10 0 0 1 40 68Z';
const RIM = 'M30 88h130';
const LABEL =
  'M84 98H106A4 4 0 0 1 110 102V114A4 4 0 0 1 106 118H84A4 4 0 0 1 80 114V102A4 4 0 0 1 84 98Z';

/** A toy box with its lid off and a dashed star waiting to go in (S10, new player). */
export function emptyStatsOps(
  colors: ColorTokens,
  printed: { readonly toyInk: string; readonly white: string },
): readonly PictureOp[] {
  const lidTilt = { deg: -6, cx: 90, cy: 50 };
  return [
    { d: LID, ...fill(colors.pop), rotate: lidTilt },
    { d: LID, ...stroke(colors.border, 2.5), cap: 'butt', rotate: lidTilt },
    { d: STAR, ...stroke(colors.text, 3, 'round'), cap: 'butt', dash: [5, 5] },
    { d: BOX, ...fill(colors.primary) },
    { d: BOX, ...stroke(colors.border, 2.5), cap: 'butt' },
    { d: RIM, ...stroke(colors.text, 3.5, 'round') },
    { d: LABEL, ...fill(printed.white) },
    { d: LABEL, ...stroke(printed.toyInk, 2.5, 'round'), cap: 'butt' },
  ];
}

/** Hazard strip (S15 test builds): 20 pt band, -45 degree stripes 12 pt wide, 3 pt ink rules. */
export const HAZARD = { height: 20, stripe: 12, rule: 3 } as const;

/** Gold stripes over a toy-ink band, as parallelograms across `width` (the only repeating fill). */
export function hazardStripeOps(
  width: number,
  paints: { readonly gold: string; readonly toyInk: string },
): readonly PictureOp[] {
  const inner = HAZARD.height - HAZARD.rule * 2;
  // A stripe 12 pt wide at 45 degrees spans 12 * sqrt(2) pt horizontally.
  const run = HAZARD.stripe * Math.SQRT2;
  const band: PictureOp = {
    d: `M0 0H${String(width)}V${String(HAZARD.height)}H0Z`,
    ...fill(paints.toyInk),
  };
  const stripes: string[] = [];
  for (let x = -inner; x < width; x += run * 2) {
    const top = HAZARD.rule;
    const bottom = HAZARD.rule + inner;
    stripes.push(
      `M${String(x)} ${String(bottom)}L${String(x + run)} ${String(bottom)}L${String(x + run + inner)} ${String(top)}L${String(x + inner)} ${String(top)}Z`,
    );
  }
  return [band, { d: stripes.join(''), ...fill(paints.gold) }];
}
