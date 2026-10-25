// apps/swap-guard/src/board/draw-board.test.ts
// Spec 10 BOARD AND CONTROLS: "Draws the board from the state (shapes and colours, no image files)"
// and "Animates the events"; spec 7.3: numbers on the board follow the chosen digits.
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { SwapGuardView } from './to-view.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { BoardColors, BoardHighlight, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { SwapGuardEvent } from '@e07/swap-guard/rules/swap-guard-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint, SkPath } from '@shopify/react-native-skia';

/** Per-game ceiling of canvas calls on the busiest frame (the Shell-wide cap is 1000). */
const DRAW_CALL_BUDGET = 700;

type Recorded = {
  readonly calls: Map<string, number>;
  readonly texts: string[];
  readonly paths: SkPath[];
};

/** Counts every canvas call (a headless proxy for draw calls per frame) and keeps drawText strings. */
function recordingCanvas(): { canvas: SkCanvas; recorded: Recorded } {
  const recorded: Recorded = { calls: new Map(), texts: [], paths: [] };
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          recorded.calls.set(String(name), (recorded.calls.get(String(name)) ?? 0) + 1);
          if (name === 'drawText' && typeof args[0] === 'string') recorded.texts.push(args[0]);
          if (name === 'drawPath') recorded.paths.push(args[0] as SkPath);
        },
    },
  ) as SkCanvas;
  return { canvas, recorded };
}

const stubFont = {
  getSize: () => 16,
  getGlyphIDs: () => [1, 2],
  getGlyphWidths: () => [8, 8],
} as unknown as SkFont;
const stubPaint = new Proxy({}, { get: () => () => undefined }) as SkPaint;
const PATHS = {
  chevron: { name: 'chevron' } as unknown as SkPath,
  spear: { name: 'spear' } as unknown as SkPath,
  archer: { name: 'archer' } as unknown as SkPath,
  shield: { name: 'shield' } as unknown as SkPath,
};
const KIT: RenderKit = {
  fill: stubPaint,
  stroke: stubPaint,
  numberFont: stubFont,
  paths: PATHS,
  labels: {},
};
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const TOKENS: readonly BoardToken[] = [
  'background',
  'cell',
  'threat',
  'mark',
  'edge',
  'guard',
  'crest',
  'enemy',
  'flash',
  'badge',
  'label',
  'hint',
  'pip',
];
const COLORS: BoardColors<BoardToken> = {
  scheme: 'light',
  isColorBlind: false,
  color: Object.fromEntries(TOKENS.map((token) => [token, COLOR])) as Record<BoardToken, SkColor>,
};

/**
 * The hardest row's 6 x 6 board after the opening double hit: the guard swapped from 22 to 17
 * with the brute, whose slam and the spear's strike knocked both out; four enemies stand.
 */
const VIEW: SwapGuardView = {
  size: 6,
  guard: 17,
  enemies: [
    { id: 2, kind: 'spear', facing: 'left', cell: 27 },
    { id: 3, kind: 'archer', facing: 'left', cell: 20 },
    { id: 4, kind: 'archer', facing: 'right', cell: 33 },
    { id: 5, kind: 'archer', facing: 'down', cell: 31 },
  ],
  fallen: [
    { id: 0, kind: 'spear', facing: 'down', cell: 16 },
    { id: 1, kind: 'brute', facing: 'up', cell: 22 },
  ],
  marks: [
    { cell: 18, facing: 'left' },
    { cell: 19, facing: 'left' },
    { cell: 26, facing: 'left' },
    { cell: 34, facing: 'right' },
    { cell: 35, facing: 'right' },
  ],
  swapsLeftText: '۱۴',
  swapsLeft: 14,
  maxSwaps: 15,
  defeated: 2,
  total: 6,
  isHit: false,
};
/** The busiest turn: the swap, seven struck squares, two knock-outs and a hit on the guard. */
const BUSIEST: readonly SwapGuardEvent[] = [
  { kind: 'pieces-swapped', from: 22, to: 17, enemyId: 1 },
  {
    kind: 'strikes-landed',
    strikes: [
      { enemyId: 0, cells: [22] },
      { enemyId: 1, cells: [11, 23, 16] },
      { enemyId: 3, cells: [19, 18, 17] },
    ],
  },
  { kind: 'enemies-defeated', enemyIds: [0, 1], cells: [16, 22] },
  { kind: 'guard-hit', cell: 17, enemyIds: [3] },
];
const LAYOUT = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });

type DrawAt = {
  readonly tracks: readonly Track[];
  readonly atMs: number;
  readonly highlight?: BoardHighlight;
  readonly view?: SwapGuardView;
};

function draw(at: DrawAt): Recorded {
  const { canvas, recorded } = recordingCanvas();
  const fx = { ...sampleTimeline(at.tracks, at.atMs), pointer: IDLE_POINTER };
  const highlight = at.highlight ?? EMPTY_HIGHLIGHT;
  const view = at.view ?? VIEW;
  drawBoard(canvas, { view, fx, highlight, colors: COLORS, layout: LAYOUT, kit: KIT });
  return recorded;
}

function totalCalls(recorded: Recorded): number {
  return [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);
}

const callsOf = (recorded: Recorded, name: string): number => recorded.calls.get(name) ?? 0;
const pathsOf = (recorded: Recorded, path: SkPath): number =>
  recorded.paths.filter((drawn) => drawn === path).length;

describe('drawBoard', () => {
  const tracks = buildTimeline(BUSIEST, 'full');
  const startOf = (channel: string): number =>
    tracks.find((track) => track.channel === channel)?.startMs ?? 0;

  it('stays within the draw-call budget on the busiest frame of a turn', () => {
    const busiest = Math.max(
      ...[0, 300, 400, 500, 650, 800].map((atMs) => totalCalls(draw({ tracks, atMs }))),
    );
    expect(busiest).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('shows at moment 0 no effect that starts later (the flashes, the hit ring and the bursts wait)', () => {
    const still = draw({ tracks: [], atMs: 0 });
    const atZero = draw({ tracks, atMs: 0 });
    // At moment 0 the struck squares are still shaded and the two fallen enemies still stand, but
    // the new telegraph has not faded in: 7 old shades (fill and edge) against 5 new ones.
    expect(callsOf(atZero, 'drawRRect')).toBe(callsOf(still, 'drawRRect') + 2 * (7 - 5) + 2);
    // Spear: body, edge and its arrow; brute: no path. Eyes: two circles each.
    expect(callsOf(atZero, 'drawCircle')).toBe(callsOf(still, 'drawCircle') + 2 * 2);
    expect(pathsOf(atZero, PATHS.chevron)).toBe(pathsOf(still, PATHS.chevron) - 5 + 1);
  });

  it('flashes the struck squares, rings the hit guard and bursts the knock-outs only while they play', () => {
    const atZero = draw({ tracks, atMs: 0 });
    const flashing = draw({ tracks, atMs: startOf('flash') + 100 });
    expect(callsOf(flashing, 'drawRRect')).toBeGreaterThan(callsOf(atZero, 'drawRRect'));
    const ringing = draw({ tracks, atMs: startOf('hit') + 100 });
    expect(callsOf(ringing, 'drawCircle')).toBeGreaterThan(callsOf(atZero, 'drawCircle') + 16);
    const done = draw({ tracks, atMs: 5000 });
    expect(totalCalls(done)).toBe(totalCalls(draw({ tracks: [], atMs: 0 })));
  });

  it('draws the swaps left in the chosen digits on every frame, which a 0.1 % golden could miss', () => {
    expect(draw({ tracks: [], atMs: 0 }).texts).toStrictEqual(['۱۴']);
    expect(draw({ tracks, atMs: 400 }).texts).toStrictEqual(['۱۴']);
  });

  it('shows one pip per swap of the level, filled while the swap is left', () => {
    const pipsOf = (swapsLeft: number): number =>
      callsOf(draw({ tracks: [], atMs: 0, view: { ...VIEW, swapsLeft } }), 'drawCircle');
    expect(pipsOf(14) - pipsOf(0)).toBe(14);
    expect(pipsOf(15) - pipsOf(14)).toBe(1);
  });

  it('tells the kinds apart by shape: a spear triangle, an archer diamond, a brute square', () => {
    const one = (kind: 'spear' | 'archer' | 'brute'): Recorded =>
      draw({
        tracks: [],
        atMs: 0,
        view: { ...VIEW, marks: [], enemies: [{ id: 0, kind, facing: 'up', cell: 0 }] },
      });
    expect(pathsOf(one('spear'), PATHS.spear)).toBe(2);
    expect(pathsOf(one('archer'), PATHS.archer)).toBe(2);
    const brute = one('brute');
    expect([pathsOf(brute, PATHS.spear), pathsOf(brute, PATHS.archer)]).toStrictEqual([0, 0]);
    expect(callsOf(brute, 'drawRRect')).toBe(callsOf(one('spear'), 'drawRRect') + 2);
  });

  it('points an arrow on every struck square the way its strike goes', () => {
    const marks = [
      { cell: 0, facing: 'up' as const },
      { cell: 0, facing: 'right' as const },
    ];
    const recorded = draw({ tracks: [], atMs: 0, view: { ...VIEW, enemies: [], marks } });
    // Two arrows on one square, each turned its own way (the guard's crest turns twice too).
    expect(pathsOf(recorded, PATHS.chevron)).toBe(2);
    expect(callsOf(recorded, 'rotate')).toBe(2 + 2);
  });

  it('rings each hinted square of the host highlight', () => {
    const hinted = [{ regionId: 'board', col: 2, row: 2 }];
    const plain = draw({ tracks: [], atMs: 0 });
    const withHint = draw({ tracks: [], atMs: 0, highlight: { selected: null, hinted } });
    expect(callsOf(withHint, 'drawRRect')).toBe(callsOf(plain, 'drawRRect') + 1);
  });

  it('grows the enemies a continue gives back from nothing', () => {
    const back = buildTimeline(
      [{ kind: 'swap-reversed', from: 17, to: 22, enemyId: 1, restoredIds: [2] }],
      'full',
    );
    const restored = {
      ...VIEW,
      enemies: [{ id: 2, kind: 'brute' as const, facing: 'up' as const, cell: 0 }],
    };
    const atZero = draw({ tracks: back, atMs: 0, view: restored });
    const later = draw({ tracks: back, atMs: 400, view: restored });
    expect(callsOf(later, 'drawRRect')).toBeGreaterThan(callsOf(atZero, 'drawRRect'));
  });
});

/** A paint that acts like Skia's: setColor takes the colour's own alpha, setAlphaf replaces it. */
function tokenPaint(token: SkColor): {
  paint: SkPaint;
  alpha: () => number;
  isToken: () => boolean;
} {
  let alpha = 1;
  let isToken = false;
  const paint = new Proxy(
    {},
    {
      get: (_target, name) => (value: unknown) => {
        if (name === 'setColor') {
          isToken = value === token;
          alpha = (value as SkColor)[3] ?? 1;
        }
        if (name === 'setAlphaf' && typeof value === 'number') alpha = value;
      },
    },
  ) as SkPaint;
  return { paint, alpha: () => alpha, isToken: () => isToken };
}

type TokenAt = DrawAt & {
  readonly token: BoardToken;
  readonly paint: 'fill' | 'stroke';
  readonly call: string;
};

/** The alpha of every `call` drawn with `token` on one frame where the token has `tokenAlpha`. */
function tokenAlphas(at: TokenAt, tokenAlpha: number): number[] {
  const color = new Float32Array([0, 0, 0, tokenAlpha]) as SkColor;
  const probe = tokenPaint(color);
  const seen: number[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          if (name === at.call && args.at(-1) === probe.paint && probe.isToken()) {
            seen.push(probe.alpha());
          }
        },
    },
  ) as SkCanvas;
  const colors = { ...COLORS, color: { ...COLORS.color, [at.token]: color } };
  const fx = { ...sampleTimeline(at.tracks, at.atMs), pointer: IDLE_POINTER };
  const kit = { ...KIT, [at.paint]: probe.paint };
  drawBoard(canvas, { view: VIEW, fx, highlight: EMPTY_HIGHLIGHT, colors, layout: LAYOUT, kit });
  return seen;
}

describe('drawBoard with a translucent token', () => {
  const tracks = buildTimeline(BUSIEST, 'full');
  const startOf = (channel: string): number =>
    tracks.find((track) => track.channel === channel)?.startMs ?? 0;
  const cases: readonly (TokenAt & { readonly name: string })[] = [
    {
      name: 'the struck squares',
      token: 'threat',
      paint: 'fill',
      call: 'drawRRect',
      tracks,
      atMs: startOf('struck') + 100,
    },
    {
      name: 'the new telegraph',
      token: 'threat',
      paint: 'fill',
      call: 'drawRRect',
      tracks,
      atMs: startOf('telegraph') + 100,
    },
    {
      name: 'the strike flash',
      token: 'flash',
      paint: 'fill',
      call: 'drawRRect',
      tracks,
      atMs: startOf('flash') + 100,
    },
    {
      name: 'the hit ring',
      token: 'flash',
      paint: 'stroke',
      call: 'drawCircle',
      tracks,
      atMs: startOf('hit') + 100,
    },
    {
      name: 'the knock-out burst',
      token: 'enemy',
      paint: 'fill',
      call: 'drawCircle',
      tracks,
      atMs: startOf('burst') + 100,
    },
  ];

  // Spec 8.12: the board draws from its palette tokens, so a token's own alpha must survive a fade.
  it.each(cases)('keeps the token alpha under the fade of $name', (at) => {
    const opaque = tokenAlphas(at, 1);
    expect(opaque.filter((alpha) => alpha > 0 && alpha < 1).length).toBeGreaterThan(0);
    expect(tokenAlphas(at, 0.5)).toStrictEqual(opaque.map((alpha) => alpha * 0.5));
  });
});
