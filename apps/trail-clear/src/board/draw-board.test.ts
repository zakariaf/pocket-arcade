// apps/trail-clear/src/board/draw-board.test.ts
// Spec 13 (trail-clear) risk: "what gets wiped" is hard to read before committing. While a turn of
// the offered tile is dragged or chosen, the board marks where it fits, outlines every tile the
// placement would wipe and shows its points in the chosen digits (7.3). The busiest frame stays in
// the draw-call budget, and nothing is told apart by colour alone (8.11).
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { create } from '@e07/trail-clear/rules/create.ts';

import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { TrailClearView } from './to-view.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type {
  BoardColors,
  BoardHighlight,
  PointerSample,
  RenderKit,
} from '@e07/shell/game-host/board-types.ts';
import type { TrailClearEvent, TrailClearState } from '@e07/trail-clear/rules/trail-clear-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint, SkPath } from '@shopify/react-native-skia';

/** Per-game ceiling of canvas calls on the busiest frame (the Shell-wide cap is 1000). */
const DRAW_CALL_BUDGET = 600;

type Recorded = {
  readonly calls: Map<string, number>;
  readonly texts: string[];
  readonly paths: string[];
};

/** Counts every canvas call (a headless proxy for draw calls per frame), keeps texts and path names. */
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
          const path = args[0] as { readonly name?: string } | undefined;
          if (name === 'drawPath' && path?.name !== undefined) recorded.paths.push(path.name);
        },
    },
  ) as SkCanvas;
  return { canvas, recorded };
}

const stubFont = {
  getGlyphIDs: () => [1, 2, 3],
  getGlyphWidths: () => [8, 8, 8],
  getSize: () => 16,
} as unknown as SkFont;
const stubPaint = new Proxy({}, { get: () => () => undefined }) as SkPaint;
/** Every unit path the draw code asks for exists and carries its name (so its order can be read). */
const NAMED_PATHS = new Proxy({}, { get: (_target, name) => ({ name: String(name) }) }) as Readonly<
  Partial<Record<string, SkPath>>
>;
const KIT: RenderKit = {
  fill: stubPaint,
  stroke: stubPaint,
  numberFont: stubFont,
  paths: NAMED_PATHS,
  labels: {},
};
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const COLORS = {
  scheme: 'light',
  isColorBlind: false,
  color: new Proxy({}, { get: () => COLOR }),
} as unknown as BoardColors<BoardToken>;
const PERSIAN = {
  formatNumber: (value: number) =>
    String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(digit))),
};

/** Greedy play of seed 53 in the endless run: placement 32 is a ford that closes a double. */
/** Its placements, each as its turns, column and row. */
const BUSIEST_LINE =
  '011 110 330 111 320 320 330 130 022 023 312 033 240 102 003 041 043 102 100 004 320 120 024 034 032 231 231 001 033 312 314 003';

function replay(start: TrailClearState): {
  readonly state: TrailClearState;
  readonly events: readonly TrailClearEvent[];
} {
  let played: { state: TrailClearState; events: readonly TrailClearEvent[] } = {
    state: start,
    events: [],
  };
  for (const [turns, col, row] of BUSIEST_LINE.split(' ').map((move) =>
    [0, 1, 2].map((at) => Number(move.charAt(at))),
  )) {
    played = applyMove(played.state, {
      kind: 'place-tile',
      turns: turns ?? 0,
      col: col ?? 0,
      row: row ?? 0,
    });
  }
  return played;
}

const BUSIEST = replay(create(53, 100));
const BUSIEST_VIEW = toView(BUSIEST.state, PERSIAN);
/** Seed 1's opening: the ford turned once (tray slot 1) closes both ends on cell 13 for 160. */
const OPENING_VIEW = toView(create(1, 0), PERSIAN);
const LAYOUT = layoutBoard({ width: 390, height: 560, view: OPENING_VIEW, isMirrored: false });
const SPOT: BoardTarget = { regionId: 'board', col: 3, row: 2 };

type DrawInput = {
  readonly atMs?: number;
  readonly view?: TrailClearView;
  readonly tracks?: readonly Track[];
  readonly pointer?: PointerSample;
  readonly highlight?: BoardHighlight;
  readonly kit?: RenderKit;
  readonly layout?: typeof LAYOUT;
};

function drawAt(input: DrawInput): Recorded {
  const fx = {
    ...sampleTimeline(input.tracks ?? [], input.atMs ?? 0),
    pointer: input.pointer ?? IDLE_POINTER,
  };
  const { canvas, recorded } = recordingCanvas();
  drawBoard(canvas, {
    view: input.view ?? OPENING_VIEW,
    fx,
    highlight: input.highlight ?? EMPTY_HIGHLIGHT,
    colors: COLORS,
    layout: input.layout ?? LAYOUT,
    kit: input.kit ?? KIT,
  });
  return recorded;
}

/** The pointer while a finger drags tray slot `slot` over `hover`. */
function dragging(slot: number, hover: BoardTarget | null): PointerSample {
  return {
    ...IDLE_POINTER,
    isDown: true,
    dragFrom: { regionId: 'tray', col: slot, row: 0 },
    hover,
  };
}

const count = (recorded: Recorded, name: string): number => recorded.calls.get(name) ?? 0;
const totalCalls = (recorded: Recorded): number =>
  [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);
/** Extra calls of `name` in `after` over `before`. */
const extra = (after: Recorded, before: Recorded, name: string): number =>
  count(after, name) - count(before, name);

describe('drawBoard', () => {
  it('stays within the draw-call budget on the busiest frames of a turn and of a drag', () => {
    const tracks = buildTimeline(BUSIEST.events, 'full');
    const turn = [0, 150, 300, 450, 600, 800].map((atMs) =>
      drawAt({ atMs, view: BUSIEST_VIEW, tracks }),
    );
    const drag = drawAt({ view: BUSIEST_VIEW, pointer: dragging(0, SPOT) });
    expect(count(drawAt({ atMs: 450, view: BUSIEST_VIEW, tracks }), 'drawCircle')).toBeGreaterThan(
      5,
    );
    expect(Math.max(...[...turn, drag].map(totalCalls))).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('shows at moment 0 no effect that starts later (the double ring and its burst)', () => {
    const tracks = buildTimeline(BUSIEST.events, 'full');
    const withoutEffects = tracks.filter((track) => !['double', 'burst'].includes(track.channel));
    expect(drawAt({ atMs: 0, view: BUSIEST_VIEW, tracks }).calls).toStrictEqual(
      drawAt({ atMs: 0, view: BUSIEST_VIEW, tracks: withoutEffects }).calls,
    );
    expect(drawAt({ atMs: 400, view: BUSIEST_VIEW, tracks }).calls).not.toStrictEqual(
      drawAt({ atMs: 400, view: BUSIEST_VIEW, tracks: withoutEffects }).calls,
    );
  });

  it('plays the double ring and its burst to the end of their tracks, and draws neither after', () => {
    const tracks = buildTimeline(BUSIEST.events, 'full');
    for (const channel of ['double', 'burst']) {
      const effect = tracks.find((track) => track.channel === channel);
      if (effect === undefined) throw new Error(`no ${channel} track`);
      const others = tracks.filter((track) => track !== effect);
      const endMs = effect.startMs + effect.durationMs;
      const drawn = (atMs: number, hasEffect: boolean): Recorded['calls'] =>
        drawAt({ atMs, view: BUSIEST_VIEW, tracks: hasEffect ? tracks : others }).calls;
      expect(drawn(endMs - 1, true)).not.toStrictEqual(drawn(endMs - 1, false));
      expect(drawn(endMs, true)).toStrictEqual(drawn(endMs, false));
    }
  });

  it('keeps the wiped tiles on the board until they have shrunk away', () => {
    const tracks = buildTimeline(BUSIEST.events, 'full').filter(
      (track) => track.channel === 'wipe',
    );
    const start = drawAt({ atMs: 0, view: BUSIEST_VIEW, tracks });
    const end = drawAt({ atMs: 5000, view: BUSIEST_VIEW, tracks });
    // Five wiped tiles, each a lit face and its ink edge.
    expect(extra(start, end, 'drawRRect')).toBe(10);
  });

  it('grows the dealt tile into its tray slots instead of showing it before the move plays', () => {
    const tracks = buildTimeline(BUSIEST.events, 'full').filter(
      (track) => track.channel === 'tray',
    );
    const start = drawAt({ atMs: 0, view: BUSIEST_VIEW, tracks });
    const end = drawAt({ atMs: 5000, view: BUSIEST_VIEW, tracks });
    // The road bend in its four turns, each a face and its ink edge.
    expect(extra(end, start, 'drawRRect')).toBe(8);
  });

  it('draws roads over rivers, a house at a road end and a pond at a river end', () => {
    const ford = {
      ...OPENING_VIEW,
      cells: OPENING_VIEW.cells.map((_, cell) => (cell === 6 ? [1, 0, 2, 0] : [])),
    };
    const drawn = drawAt({ view: { ...ford, tray: [] } });
    expect(drawn.paths).toStrictEqual(['river-stub-2', 'road-stub-0', 'line-stub-0', 'house-0']);
    expect(count(drawn, 'drawCircle')).toBe(1);
  });

  it('previews a drag over the double spot: the ghost, a ring on each tile it wipes, its points in Persian', () => {
    const idle = drawAt({});
    const over = drawAt({ pointer: dragging(1, SPOT) });
    // Ghost (face and edge), three wipe rings (cells 12, 13, 14) and the points badge (face and edge).
    expect(extra(over, idle, 'drawRRect')).toBe(7);
    // A dot on each of the 13 cells this turn fits, and the ghost ford's pond.
    expect(extra(over, idle, 'drawCircle')).toBe(14);
    expect([idle.texts, over.texts]).toStrictEqual([[], ['۱۶۰']]);
  });

  it('dims a ghost that does not fit and shows no wipe or points for it', () => {
    const idle = drawAt({});
    const over = drawAt({ pointer: dragging(0, SPOT) });
    expect([
      extra(over, idle, 'drawRRect'),
      extra(over, idle, 'drawCircle'),
      over.texts,
    ]).toStrictEqual([2, 9, []]);
  });

  it('draws no ghost while the dragged tile is off the board, only where it fits', () => {
    const idle = drawAt({});
    const off = drawAt({ pointer: dragging(1, { regionId: 'tray', col: 2, row: 0 }) });
    expect([extra(off, idle, 'drawRRect'), extra(off, idle, 'drawCircle')]).toStrictEqual([0, 13]);
  });

  it('marks a chosen turn for tap-then-tap: its slot ringed, where it fits, what it would score', () => {
    const idle = drawAt({});
    const chosen = drawAt({
      highlight: { selected: { regionId: 'tray', col: 1, row: 0 }, hinted: [] },
    });
    expect([extra(chosen, idle, 'drawRRect'), extra(chosen, idle, 'drawCircle')]).toStrictEqual([
      3, 13,
    ]);
    expect(chosen.texts).toStrictEqual(['۱۶۰']);
  });

  it('rings each hinted or coached target, on the tray and on the board', () => {
    const idle = drawAt({});
    const hinted = drawAt({
      highlight: { selected: null, hinted: [{ regionId: 'tray', col: 1, row: 0 }, SPOT] },
    });
    expect(extra(hinted, idle, 'drawRRect')).toBe(2);
  });

  it('skips digits without a number font and the shapes without their paths', () => {
    const bare = { ...KIT, numberFont: null, paths: {} };
    const chosen = { selected: { regionId: 'tray', col: 1, row: 0 }, hinted: [] };
    const drawn = drawAt({ kit: bare, highlight: chosen });
    expect([drawn.texts, drawn.paths]).toStrictEqual([[], []]);
  });

  it('draws nothing but the background before the canvas has a size', () => {
    const empty = { width: 0, height: 0, isMirrored: false, regions: [] };
    const drawn = drawAt({
      layout: empty,
      tracks: buildTimeline(BUSIEST.events, 'full'),
      atMs: 300,
    });
    expect([...drawn.calls.keys()]).toStrictEqual(['drawColor']);
  });
});

/** A paint that acts like Skia's: setColor takes the colour's own alpha, setAlphaf replaces it. */
function alphaPaint(): { readonly paint: SkPaint; readonly alpha: () => number } {
  let alpha = 1;
  const paint = new Proxy(
    {},
    {
      get: (_target, name) => (value: unknown) => {
        if (name === 'setColor') alpha = (value as SkColor)[3] ?? 1;
        if (name === 'setAlphaf' && typeof value === 'number') alpha = value;
      },
    },
  ) as SkPaint;
  return { paint, alpha: () => alpha };
}

/** The alpha of every draw call of one frame where every palette token has alpha `tokenAlpha`. */
function drawnAlphas(input: DrawInput, tokenAlpha: number): number[] {
  const fill = alphaPaint();
  const stroke = alphaPaint();
  const seen: number[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          if (!String(name).startsWith('draw')) return;
          const paint = args.at(-1);
          if (paint === fill.paint) seen.push(fill.alpha());
          if (paint === stroke.paint) seen.push(stroke.alpha());
        },
    },
  ) as SkCanvas;
  const translucent = new Float32Array([0, 0, 0, tokenAlpha]) as SkColor;
  const colors = {
    ...COLORS,
    color: new Proxy({}, { get: () => translucent }),
  } as BoardColors<BoardToken>;
  const fx = {
    ...sampleTimeline(input.tracks ?? [], input.atMs ?? 0),
    pointer: input.pointer ?? IDLE_POINTER,
  };
  drawBoard(canvas, {
    view: input.view ?? OPENING_VIEW,
    fx,
    highlight: input.highlight ?? EMPTY_HIGHLIGHT,
    colors,
    layout: input.layout ?? LAYOUT,
    kit: { ...KIT, fill: fill.paint, stroke: stroke.paint },
  });
  return seen;
}

describe('drawBoard with translucent tokens', () => {
  const tracks = buildTimeline(BUSIEST.events, 'full');
  const frames: readonly (DrawInput & { readonly name: string })[] = [
    { name: 'the dimmed ghost that does not fit', pointer: dragging(0, SPOT) },
    {
      name: 'the wiped tiles, the double ring and its burst',
      atMs: 400,
      view: BUSIEST_VIEW,
      tracks,
    },
  ];

  it.each(frames)('draws $name no stronger than the token itself', (frame) => {
    const alphas = drawnAlphas(frame, 0.5);
    expect(alphas.length).toBeGreaterThan(0);
    expect(alphas.filter((alpha) => alpha > 0.5 + 1e-6)).toStrictEqual([]);
  });

  it.each(frames)('fades $name from the token alpha, never past it', (frame) => {
    const faded = drawnAlphas(frame, 1).filter((alpha) => alpha < 1);
    const halved = drawnAlphas(frame, 0.5).filter((alpha) => alpha < 0.5 - 1e-6);
    expect(faded.length).toBeGreaterThan(0);
    expect(halved).toStrictEqual(faded.map((alpha) => alpha * 0.5));
  });
});
