// apps/stepstone/src/board/draw-board.test.ts
// Spec 8.11: nothing is told apart by colour alone (each hop kind has its glyph), and moving parts
// respect Reduce motion; spec 7.3: the numbers on the board follow the chosen digits.
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';
import { applyMove } from '@e07/stepstone/rules/apply-move.ts';
import { pondFromText } from '@e07/stepstone/rules/pond-text.ts';

import { buildTimeline } from './build-timeline.ts';
import { cellBox, drawBoard } from './draw-board.ts';
import { frogCenter } from './draw-frog.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { StepstoneView } from './to-view.ts';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { BoardColors, BoardHighlight, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint, SkPath } from '@shopify/react-native-skia';

/** Per-game ceiling of canvas calls on the busiest frame (the Shell-wide cap is 1000). */
const DRAW_CALL_BUDGET = 500;

type Call = { readonly name: string; readonly args: readonly unknown[] };
type Recorded = { readonly calls: Call[]; readonly texts: string[] };

/** Records every canvas call with its arguments (a headless proxy for draw calls per frame). */
function recordingCanvas(): { canvas: SkCanvas; recorded: Recorded } {
  const recorded: Recorded = { calls: [], texts: [] };
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          recorded.calls.push({ name: String(name), args });
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
const stubPath = {} as SkPath;
const KIT: RenderKit = {
  fill: stubPaint,
  stroke: stubPaint,
  numberFont: stubFont,
  paths: {
    king: stubPath,
    rook: stubPath,
    bishop: stubPath,
    knight: stubPath,
    flag: stubPath,
    frog: stubPath,
  },
  labels: {},
};
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const TOKENS: readonly BoardToken[] = [
  'background',
  'ripple',
  'stoneKing',
  'stoneRook',
  'stoneBishop',
  'stoneKnight',
  'edge',
  'glyph',
  'flag',
  'flagMark',
  'frog',
  'frogEye',
  'reach',
  'hint',
  'glow',
  'label',
];
const COLORS = {
  scheme: 'dark',
  isColorBlind: false,
  color: Object.fromEntries(TOKENS.map((token) => [token, COLOR])),
} as BoardColors<BoardToken>;
const PERSIAN = { formatNumber: (value: number) => new Intl.NumberFormat('fa').format(value) };

function pond(rows: readonly string[], moves: number): StepstoneState {
  return { ...pondFromText(rows.join('\n')), moves, par: 9, kindsUsed: ['rook', 'king'] };
}

/** The busiest turn: a full 7 × 7 pond, the rook at 3 hops down its column onto the flag at 45. */
const BUSY = pond(
  ['KRBrNKR', 'BNKRBNK', 'RKBNRKB', 'NRKBNRK', 'KBNRKBN', 'B~~~~~R', 'R..F..K'],
  11,
);
const WIN = applyMove(BUSY, { kind: 'hop', to: 45 });
/** The golden pond's first hop: the rook at 2 onto a king, a hop kind new this run. */
const GOLDEN = pond(['..r..', '.....', '..K.F', '..RK.', '.....'], 0);
const NEW_KIND = applyMove({ ...GOLDEN, kindsUsed: ['rook'] }, { kind: 'hop', to: 12 });

type Turn = { readonly view: StepstoneView; readonly tracks: readonly Track[] };

function turnOf(result: {
  state: StepstoneState;
  events: Parameters<typeof buildTimeline>[0];
}): Turn {
  return { view: toView(result.state, PERSIAN), tracks: buildTimeline(result.events, 'full') };
}

/** A rook hop onto a king with only water around it: the frog is stranded. */
const STRANDED = applyMove(pond(['r...K', '.....', 'R...F', '.....', '.....'], 0), {
  kind: 'hop',
  to: 4,
});
const WIN_TURN = turnOf(WIN);
const NEW_KIND_TURN = turnOf(NEW_KIND);

type DrawAt = {
  readonly turn: Turn;
  readonly atMs: number;
  readonly view?: StepstoneView;
  readonly highlight?: BoardHighlight;
  readonly kit?: RenderKit;
  /** Draw before the canvas has a size: a layout with no region yet. */
  readonly isUnsized?: boolean;
};

const UNSIZED: BoardLayout = { width: 0, height: 0, isMirrored: false, regions: [] };

function frameAt(at: DrawAt) {
  const view = at.view ?? at.turn.view;
  const layout =
    at.isUnsized === true
      ? UNSIZED
      : layoutBoard({ width: 390, height: 560, view, isMirrored: false });
  const fx = { ...sampleTimeline(at.turn.tracks, at.atMs), pointer: IDLE_POINTER };
  const highlight = at.highlight ?? EMPTY_HIGHLIGHT;
  return { view, fx, highlight, colors: COLORS, layout, kit: at.kit ?? KIT };
}

function draw(at: DrawAt): Recorded {
  const { canvas, recorded } = recordingCanvas();
  drawBoard(canvas, frameAt(at));
  return recorded;
}

function count(recorded: Recorded, name: string): number {
  return recorded.calls.filter((call) => call.name === name).length;
}

/** The sizes of every unit shape (a glyph, the frog) drawn centred on a point: translate, then scale. */
function sizesCentredOn(recorded: Recorded, point: { x: number; y: number }): number[] {
  return recorded.calls.flatMap((call, index) => {
    const before = recorded.calls[index - 1];
    if (call.name !== 'scale' || before?.name !== 'translate') return [];
    const size = Number(call.args[0]);
    const x = Number(before.args[0]) + size / 2;
    const y = Number(before.args[1]) + size / 2;
    return Math.abs(x - point.x) < 0.5 && Math.abs(y - point.y) < 0.5 ? [size] : [];
  });
}

function centre(view: StepstoneView, index: number): { x: number; y: number } {
  const rect = cellBox(frameAt({ turn: WIN_TURN, atMs: 0, view }), index);
  if (rect === null) throw new Error('no cell');
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

const END = timelineEndMs(WIN_TURN.tracks);

describe('drawBoard', () => {
  it('stays within the draw-call budget on the busiest frame of a turn', () => {
    const recorded = draw({ turn: WIN_TURN, atMs: 500 });
    expect(count(recorded, 'drawCircle')).toBeGreaterThan(12);
    expect(recorded.calls.length).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('shows at moment 0 and at the end no effect that is not playing (glow, burst and count)', () => {
    // Six ripples (the five sunk stones and the stone the frog leaves) and the frog's six eye circles.
    for (const atMs of [0, END]) {
      const recorded = draw({ turn: WIN_TURN, atMs });
      expect(count(recorded, 'drawCircle')).toBe(12);
      expect(recorded.texts).toStrictEqual([]);
    }
  });

  it('draws the localised hop count on the flag while the frog lands, which a 0.1 % golden could miss', () => {
    expect(draw({ turn: WIN_TURN, atMs: 500 }).texts).toStrictEqual(['۱۲']);
  });

  it('plays the goal glow, the hop count and the burst to the end of each of their tracks', () => {
    // The goal track (out-back) runs from 320 to 920 ms, the burst (16 particles) from 320 to 1020 ms.
    // Twelve circles are always there: six ripples and the frog's six eye circles.
    for (const atMs of [400, 600, 800, 910]) {
      const recorded = draw({ turn: WIN_TURN, atMs });
      expect([atMs, recorded.texts, count(recorded, 'drawCircle')]).toStrictEqual([
        atMs,
        ['۱۲'],
        29,
      ]);
    }
    for (const atMs of [930, 1000]) {
      const recorded = draw({ turn: WIN_TURN, atMs });
      expect([atMs, recorded.texts, count(recorded, 'drawCircle')]).toStrictEqual([atMs, [], 28]);
    }
  });

  it('rings every stone in reach once the frog has landed, and none while it is in the air', () => {
    const { view } = NEW_KIND_TURN;
    const without = { ...view, reach: [] };
    const ringsAt = (atMs: number): number =>
      count(draw({ turn: NEW_KIND_TURN, atMs }), 'drawRRect') -
      count(draw({ turn: NEW_KIND_TURN, atMs, view: without }), 'drawRRect');
    expect(view.reach.length).toBeGreaterThan(0);
    expect(ringsAt(100)).toBe(0);
    expect(ringsAt(timelineEndMs(NEW_KIND_TURN.tracks))).toBe(view.reach.length);
  });

  it('rings each hinted stone of the host highlight', () => {
    const atMs = timelineEndMs(NEW_KIND_TURN.tracks);
    const hinted = [{ regionId: 'board', col: 3, row: 3 }];
    const plain = draw({ turn: NEW_KIND_TURN, atMs });
    const withHint = draw({ turn: NEW_KIND_TURN, atMs, highlight: { selected: null, hinted } });
    expect(count(withHint, 'drawRRect')).toBe(count(plain, 'drawRRect') + 1);
    const elsewhere = [{ regionId: 'tray', col: 0, row: 0 }];
    const offBoard = draw({
      turn: NEW_KIND_TURN,
      atMs,
      highlight: { selected: null, hinted: elsewhere },
    });
    expect(count(offBoard, 'drawRRect')).toBe(count(plain, 'drawRRect'));
  });

  it('draws only the water before the canvas has a size', () => {
    const hinted = [{ regionId: 'board', col: 0, row: 0 }];
    const frames = [
      draw({ turn: WIN_TURN, atMs: 500, isUnsized: true }),
      draw({
        turn: NEW_KIND_TURN,
        atMs: 1000,
        isUnsized: true,
        highlight: { selected: null, hinted },
      }),
    ];
    expect(frames.map((recorded) => recorded.calls.map((call) => call.name))).toStrictEqual([
      ['drawColor'],
      ['drawColor'],
    ]);
  });

  it('draws the goal glow without the count until the number font has loaded', () => {
    const recorded = draw({ turn: WIN_TURN, atMs: 500, kit: { ...KIT, numberFont: null } });
    expect(recorded.texts).toStrictEqual([]);
    expect(count(recorded, 'drawCircle')).toBeGreaterThan(12);
  });

  it('draws every stone face before its glyph paths exist', () => {
    const bare = draw({ turn: WIN_TURN, atMs: END, kit: { ...KIT, paths: {} } });
    const full = draw({ turn: WIN_TURN, atMs: END });
    expect(count(bare, 'drawRRect')).toBe(count(full, 'drawRRect'));
    expect(count(bare, 'drawPath')).toBe(0);
  });

  it("keeps the landing stone's glyph at full size at moment 0, then pops it once the frog lands", () => {
    const at = centre(NEW_KIND_TURN.view, 12);
    const glyphAt = (atMs: number): number =>
      Math.min(...sizesCentredOn(draw({ turn: NEW_KIND_TURN, atMs }), at));
    const atRest = glyphAt(timelineEndMs(NEW_KIND_TURN.tracks));
    expect(glyphAt(0)).toBe(atRest);
    expect(glyphAt(360)).toBeLessThan(atRest);
  });

  it('keeps popping the glyph through its out-back overshoot, until the pop track ends', () => {
    // The pop starts at 320 ms for 260 ms; its eased scale passes 1 at about 37 % of its time.
    const at = centre(NEW_KIND_TURN.view, 12);
    const glyphAt = (atMs: number): number =>
      Math.min(...sizesCentredOn(draw({ turn: NEW_KIND_TURN, atMs }), at));
    const atRest = glyphAt(timelineEndMs(NEW_KIND_TURN.tracks));
    for (const atMs of [450, 500, 560]) {
      expect(glyphAt(atMs)).toBeGreaterThan(atRest);
    }
    expect(glyphAt(580)).toBe(atRest);
  });
});

describe('frogCenter', () => {
  it('starts the hop on the old stone, arcs above the straight line and lands on the target', () => {
    const { view, tracks } = WIN_TURN;
    const at = (atMs: number) => frogCenter(frameAt({ turn: WIN_TURN, atMs }), cellBox);
    const from = centre(view, 3);
    const to = centre(view, 45);
    expect(at(0)).toMatchObject(from);
    expect(at(timelineEndMs(tracks))).toMatchObject(to);
    const middle = at(160);
    expect(middle?.y).toBeLessThan((from.y + to.y) / 2);
  });

  it('rests the frog on its stone with no turn playing, and draws none before the canvas has a size', () => {
    const { view } = NEW_KIND_TURN;
    const still = { view, tracks: [] };
    expect(frogCenter(frameAt({ turn: still, atMs: 0 }), cellBox)).toMatchObject(centre(view, 12));
    expect(frogCenter(frameAt({ turn: still, atMs: 0, isUnsized: true }), cellBox)).toBeNull();
  });

  it('shakes a stranded frog to both sides while its track plays, and holds it still under reduced motion', () => {
    const xAt = (motion: 'full' | 'reduced', atMs: number): number | undefined => {
      const turn = {
        view: toView(STRANDED.state, PERSIAN),
        tracks: buildTimeline(STRANDED.events, motion),
      };
      return frogCenter(frameAt({ turn, atMs }), cellBox)?.x;
    };
    const rest = centre(toView(STRANDED.state, PERSIAN), 4).x;
    expect(xAt('full', 350)).toBeGreaterThan(rest);
    expect(xAt('full', 410)).toBeLessThan(rest);
    expect([xAt('reduced', 190), xAt('reduced', 250)]).toStrictEqual([rest, rest]);
  });
});

/** A paint that remembers its alpha the way Skia does: setColor takes the colour's, setAlphaf replaces it. */
function alphaPaint(): { paint: SkPaint; alpha: () => number } {
  let alpha = 1;
  const paint = new Proxy(
    {
      setColor: (color: SkColor) => {
        alpha = color[3] ?? 1;
      },
      setAlphaf: (value: number) => {
        alpha = value;
      },
    },
    { get: (target, name) => Reflect.get(target, name) ?? (() => undefined) },
  ) as unknown as SkPaint;
  return { paint, alpha: () => alpha };
}

/** The alpha of every fill and stroke draw over the whole win turn, with every token at `tokenAlpha`. */
function drawnAlphas(tokenAlpha: number): number[] {
  const fill = alphaPaint();
  const stroke = alphaPaint();
  const seen: number[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        () =>
        (...args: unknown[]) => {
          if (args.includes(fill.paint)) seen.push(fill.alpha());
          if (args.includes(stroke.paint)) seen.push(stroke.alpha());
        },
    },
  ) as SkCanvas;
  const color = new Float32Array([0, 0, 0, tokenAlpha]) as SkColor;
  const colors = {
    ...COLORS,
    color: Object.fromEntries(TOKENS.map((token) => [token, color])) as Record<BoardToken, SkColor>,
  };
  const kit = { ...KIT, fill: fill.paint, stroke: stroke.paint };
  for (let atMs = 0; atMs <= END; atMs += 20) {
    drawBoard(canvas, { ...frameAt({ turn: WIN_TURN, atMs, kit }), colors });
  }
  return seen;
}

describe('drawBoard with a translucent token', () => {
  it("fades the goal glow and the burst from the token's own alpha (board-rendering-skia)", () => {
    const opaque = drawnAlphas(1);
    const half = drawnAlphas(0.5);
    expect(opaque.some((alpha) => alpha > 0 && alpha < 1)).toBe(true);
    expect(half).toStrictEqual(opaque.map((alpha) => alpha * 0.5));
  });

  it('draws no negative alpha while the glow overshoots', () => {
    expect(Math.min(...drawnAlphas(1))).toBeGreaterThanOrEqual(0);
  });
});
