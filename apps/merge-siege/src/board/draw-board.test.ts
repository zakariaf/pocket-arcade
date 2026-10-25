// apps/merge-siege/src/board/draw-board.test.ts
// The board's draw (board-rendering-skia rules 2, 7, 11, 16, 17): within its draw-call budget on
// the busiest frame, no effect before its track starts, the numbers in the chosen digits (spec 7.3,
// asserted through the recording canvas: a 0.1 % golden cannot see a missing number), the next
// enemy in the gate and the host's hinted ring.
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { applyMove } from '@e07/merge-siege/rules/apply-move.ts';
import { create } from '@e07/merge-siege/rules/create.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { MergeSiegeView } from './to-view.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { BoardColors, BoardHighlight, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint, SkPath } from '@shopify/react-native-skia';

/** Per-game ceiling of canvas calls on the busiest frame (the Shell-wide cap is 1000). */
const DRAW_CALL_BUDGET = 500;

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
  'floor',
  'cell',
  'gate',
  'base',
  'edge',
  'tile',
  'tileInk',
  'enemy',
  'enemyInk',
  'burst',
  'hint',
];
const COLORS: BoardColors<BoardToken> = {
  scheme: 'dark',
  isColorBlind: false,
  color: Object.fromEntries(TOKENS.map((token) => [token, COLOR])) as Record<BoardToken, SkColor>,
};
const PERSIAN = {
  formatNumber: (value: number): string =>
    String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] ?? d),
};
/** The busiest turn: seed 1's first swipe up smashes both opening enemies and one at the gate. */
const START = create(1, 0);
const TURN = applyMove(START, { kind: 'swipe', direction: 'up' });
const VIEW: MergeSiegeView = toView(TURN.state, PERSIAN);
const TRACKS = buildTimeline(TURN.events, 'full');
const LAYOUT = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });

type DrawAt = {
  readonly tracks: readonly Track[];
  readonly atMs: number;
  readonly view?: MergeSiegeView;
  readonly highlight?: BoardHighlight;
};

function draw(at: DrawAt): Recorded {
  const { canvas, recorded } = recordingCanvas();
  const fx = { ...sampleTimeline(at.tracks, at.atMs), pointer: IDLE_POINTER };
  const view = at.view ?? VIEW;
  drawBoard(canvas, {
    view,
    fx,
    highlight: at.highlight ?? EMPTY_HIGHLIGHT,
    colors: COLORS,
    layout: LAYOUT,
    kit: KIT,
  });
  return recorded;
}

const totalCalls = (recorded: Recorded): number =>
  [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);

describe('drawBoard', () => {
  it('stays within the draw-call budget on the busiest frame of a turn', () => {
    const recorded = draw({ tracks: TRACKS, atMs: 260 });
    expect(recorded.calls.get('drawCircle')).toBeGreaterThan(1);
    expect(totalCalls(recorded)).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('shows at moment 0 the board before the swipe: every enemy, no burst, no new tile yet', () => {
    const recorded = draw({ tracks: TRACKS, atMs: 0 });
    expect(recorded.calls.get('drawCircle') ?? 0).toBe(0);
    // Before the swipe: two 2-enemies, the player's 2, 2 and 4, and the 4 waiting in the gate (the
    // new tile and the next enemy after it are not there yet).
    expect([...recorded.texts].sort()).toStrictEqual(['۲', '۲', '۲', '۲', '۴', '۴']);
  });

  it('draws every number in the chosen digits once the turn has played', () => {
    const recorded = draw({ tracks: TRACKS, atMs: 5000 });
    const expected = VIEW.pieces.map((piece) => PERSIAN.formatNumber(piece.value));
    const next = VIEW.next === null ? [] : [PERSIAN.formatNumber(VIEW.next.value)];
    expect([...recorded.texts].sort()).toStrictEqual([...expected, ...next].sort());
  });

  it('shows the next enemy in the gate on a board at rest', () => {
    const atRest = toView(START, PERSIAN);
    const recorded = draw({ tracks: [], atMs: 0, view: atRest });
    expect(recorded.texts).toContain(PERSIAN.formatNumber(atRest.next?.value ?? 0));
  });

  it('tells enemies from tiles by shape: the spiky path against rounded squares', () => {
    const { canvas, recorded } = recordingCanvas();
    const kit = { ...KIT, paths: { enemy: {} as SkPath } };
    const atRest = toView(START, PERSIAN);
    const fx = { ...sampleTimeline([], 0), pointer: IDLE_POINTER };
    const frame = { view: atRest, fx, highlight: EMPTY_HIGHLIGHT, colors: COLORS, layout: LAYOUT };
    drawBoard(canvas, { ...frame, kit });
    const enemies = atRest.pieces.filter((piece) => piece.kind === 1).length + 1;
    // A fill and an ink edge per enemy, the one waiting in the gate included.
    expect(recorded.calls.get('drawPath')).toBe(2 * enemies);
  });

  it('rings each hinted cell of the host highlight', () => {
    const hinted = [{ regionId: 'board', col: 2, row: 2 }];
    const plain = draw({ tracks: [], atMs: 0 });
    const withHint = draw({ tracks: [], atMs: 0, highlight: { selected: null, hinted } });
    expect(withHint.calls.get('drawRRect')).toBe((plain.calls.get('drawRRect') ?? 0) + 1);
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

/** The alpha of every fill and stroke draw over a whole turn, with every token at `tokenAlpha`. */
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
  for (let atMs = 0; atMs <= timelineEndMs(TRACKS); atMs += 20) {
    const fx = { ...sampleTimeline(TRACKS, atMs), pointer: IDLE_POINTER };
    drawBoard(canvas, { view: VIEW, fx, highlight: EMPTY_HIGHLIGHT, colors, layout: LAYOUT, kit });
  }
  return seen;
}

describe('drawBoard with a translucent token', () => {
  it("fades every piece, number and burst from the token's own alpha (board-rendering-skia)", () => {
    const opaque = drawnAlphas(1);
    const half = drawnAlphas(0.5);
    expect(opaque.some((alpha) => alpha > 0 && alpha < 1)).toBe(true);
    expect(half).toStrictEqual(opaque.map((alpha) => alpha * 0.5));
  });
});
