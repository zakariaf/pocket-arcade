// apps/snare-snake/src/board/draw-board.test.ts
// Spec 10 BOARD AND CONTROLS: "Draws the board from the state (shapes and colours, no image files)"
// and "Animates the events"; spec 7.3: numbers on the board follow the chosen digits.
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { SnareSnakeView } from './to-view.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { BoardColors, BoardHighlight, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { SnareSnakeEvent } from '@e07/snare-snake/rules/snare-snake-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint } from '@shopify/react-native-skia';

/** Per-game ceiling of canvas calls on the busiest frame (the Shell-wide cap is 1000). */
const DRAW_CALL_BUDGET = 700;

type Recorded = { readonly calls: Map<string, number>; readonly texts: string[] };

/** Counts every canvas call (a headless proxy for draw calls per frame) and keeps drawText strings. */
function recordingCanvas(): { canvas: SkCanvas; recorded: Recorded } {
  const recorded: Recorded = { calls: new Map(), texts: [] };
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          recorded.calls.set(String(name), (recorded.calls.get(String(name)) ?? 0) + 1);
          if (name === 'drawText' && typeof args[0] === 'string') recorded.texts.push(args[0]);
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
const KIT: RenderKit = {
  fill: stubPaint,
  stroke: stubPaint,
  numberFont: stubFont,
  paths: {},
  labels: {},
};
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const TOKENS: readonly BoardToken[] = [
  'background',
  'cell',
  'snake',
  'head',
  'edge',
  'eye',
  'critter',
  'spot',
  'frost',
  'glow',
  'badge',
  'label',
  'hint',
];
const COLORS: BoardColors<BoardToken> = {
  scheme: 'light',
  isColorBlind: false,
  color: Object.fromEntries(TOKENS.map((token) => [token, COLOR])) as Record<BoardToken, SkColor>,
};

/** The hardest row's 8 x 10 board after a loop: a long snake, six critters (one frozen). */
const VIEW: SnareSnakeView = {
  cols: 8,
  rows: 10,
  snake: [27, 26, 25, 24, 32, 40, 48, 56, 57, 58, 59, 60, 61, 62, 63, 55, 47, 39],
  heading: 'right',
  critters: [
    { id: 1, cell: 2, isFrozen: false },
    { id: 3, cell: 13, isFrozen: false },
    { id: 4, cell: 35, isFrozen: true },
    { id: 5, cell: 70, isFrozen: false },
    { id: 6, cell: 77, isFrozen: false },
    { id: 7, cell: 6, isFrozen: false },
  ],
  movesLeftText: '۱۲',
  movesLeft: 12,
  caught: 2,
  total: 8,
};
/** The busiest turn: a loop catching two critters, a hop and the bonus. */
const BUSIEST: readonly SnareSnakeEvent[] = [
  { kind: 'loop-closed', loop: [28, 29, 21, 20, 19, 27], enclosed: [], spent: 5, length: 18 },
  { kind: 'critters-caught', critterIds: [0, 2], cells: [36, 12], count: 2, points: 40 },
  { kind: 'critters-moved', hops: [{ critterId: 5, from: 69, to: 70 }] },
];
const LAYOUT = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });

type DrawAt = {
  readonly tracks: readonly Track[];
  readonly atMs: number;
  readonly highlight?: BoardHighlight;
};

function draw(at: DrawAt): Recorded {
  const { canvas, recorded } = recordingCanvas();
  const fx = { ...sampleTimeline(at.tracks, at.atMs), pointer: IDLE_POINTER };
  const highlight = at.highlight ?? EMPTY_HIGHLIGHT;
  drawBoard(canvas, { view: VIEW, fx, highlight, colors: COLORS, layout: LAYOUT, kit: KIT });
  return recorded;
}

function totalCalls(recorded: Recorded): number {
  return [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);
}

const callsOf = (recorded: Recorded, name: string): number => recorded.calls.get(name) ?? 0;

/** A fill paint that acts like Skia's: setColor brings back the colour's own (opaque) alpha. */
function alphaPaint(): { paint: SkPaint; alpha: () => number } {
  let alpha = 1;
  const paint = new Proxy(
    {},
    {
      get: (_target, name) => (value: unknown) => {
        if (name === 'setColor') alpha = 1;
        if (name === 'setAlphaf' && typeof value === 'number') alpha = value;
      },
    },
  ) as SkPaint;
  return { paint, alpha: () => alpha };
}

/** The fill alpha in force at every drawRRect of one frame. */
function rrectAlphas(at: DrawAt): number[] {
  const fill = alphaPaint();
  const alphas: number[] = [];
  const canvas = new Proxy(
    {},
    {
      get: (_target, name) => () => {
        if (name === 'drawRRect') alphas.push(fill.alpha());
      },
    },
  ) as SkCanvas;
  const fx = { ...sampleTimeline(at.tracks, at.atMs), pointer: IDLE_POINTER };
  const kit = { ...KIT, fill: fill.paint };
  const frame = { view: VIEW, fx, highlight: EMPTY_HIGHLIGHT, colors: COLORS, layout: LAYOUT, kit };
  drawBoard(canvas, frame);
  return alphas;
}

describe('drawBoard', () => {
  it('stays within the draw-call budget on the busiest frame of a turn', () => {
    const recorded = draw({ tracks: buildTimeline(BUSIEST, 'full'), atMs: 300 });
    expect(totalCalls(recorded)).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('shows at moment 0 no effect that starts later (the loop flash and the burst wait)', () => {
    const still = draw({ tracks: [], atMs: 0 });
    const atZero = draw({ tracks: buildTimeline(BUSIEST, 'full'), atMs: 0 });
    const midTurn = draw({ tracks: buildTimeline(BUSIEST, 'full'), atMs: 300 });
    // At moment 0 the spent segments and the caught critters are still where they were.
    expect(callsOf(atZero, 'drawRRect')).toBe(callsOf(still, 'drawRRect') + 2 * 5);
    expect(callsOf(atZero, 'drawCircle')).toBe(callsOf(still, 'drawCircle') + 2 * 4);
    expect(callsOf(midTurn, 'drawCircle')).toBeGreaterThan(callsOf(atZero, 'drawCircle'));
  });

  it('fades the spent segments: mid-fade they are drawn see-through, not solid', () => {
    const alphas = rrectAlphas({ tracks: buildTimeline(BUSIEST, 'full'), atMs: 250 });
    expect(alphas.filter((alpha) => alpha > 0 && alpha < 1)).toHaveLength(2 * 5);
  });

  it('draws the moves left in the chosen digits on every frame, which a 0.1 % golden could miss', () => {
    expect(draw({ tracks: [], atMs: 0 }).texts).toStrictEqual(['۱۲']);
    expect(draw({ tracks: buildTimeline(BUSIEST, 'full'), atMs: 300 }).texts).toStrictEqual(['۱۲']);
  });

  it('marks a frozen critter with a ring, so frozen is told by shape as well as colour', () => {
    const frozen = draw({ tracks: [], atMs: 0 });
    const thawed = (() => {
      const { canvas, recorded } = recordingCanvas();
      const critters = VIEW.critters.map((critter) => ({ ...critter, isFrozen: false }));
      const fx = { ...sampleTimeline([], 0), pointer: IDLE_POINTER };
      const frame = {
        view: { ...VIEW, critters },
        fx,
        highlight: EMPTY_HIGHLIGHT,
        colors: COLORS,
        layout: LAYOUT,
        kit: KIT,
      };
      drawBoard(canvas, frame);
      return recorded;
    })();
    expect(callsOf(frozen, 'drawCircle')).toBe(callsOf(thawed, 'drawCircle') + 1);
  });

  it('rings each hinted cell of the host highlight', () => {
    const hinted = [{ regionId: 'board', col: 2, row: 2 }];
    const plain = draw({ tracks: [], atMs: 0 });
    const withHint = draw({ tracks: [], atMs: 0, highlight: { selected: null, hinted } });
    expect(callsOf(withHint, 'drawRRect')).toBe(callsOf(plain, 'drawRRect') + 1);
  });

  it('pops the moves badge while a continue adds moves', () => {
    const tracks = buildTimeline([{ kind: 'moves-added', count: 3 }], 'full');
    expect(callsOf(draw({ tracks, atMs: 0 }), 'scale')).toBe(
      callsOf(draw({ tracks: [], atMs: 0 }), 'scale'),
    );
    expect(callsOf(draw({ tracks, atMs: 200 }), 'scale')).toBeGreaterThan(
      callsOf(draw({ tracks: [], atMs: 0 }), 'scale'),
    );
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
      name: 'the spent segments',
      token: 'snake',
      paint: 'fill',
      call: 'drawRRect',
      tracks,
      atMs: 250,
    },
    {
      name: 'their ink edge',
      token: 'edge',
      paint: 'stroke',
      call: 'drawRRect',
      tracks,
      atMs: 250,
    },
    {
      name: 'the loop flash',
      token: 'glow',
      paint: 'stroke',
      call: 'drawRRect',
      tracks,
      atMs: startOf('loop') + 60,
    },
    {
      name: 'the catch burst',
      token: 'critter',
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
