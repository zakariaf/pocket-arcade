// apps/poker-drop/src/board/draw-board.test.ts
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { continueAfterLoss } from '@e07/poker-drop/rules/continue-run.ts';
import { create } from '@e07/poker-drop/rules/create.ts';
import { busiestBoardTurn } from '@e07/poker-drop/testing/poker-drop-board-turn.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { PokerDropView } from './to-view.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { BoardColors, BoardHighlight, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint, SkPath } from '@shopify/react-native-skia';

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
const stubPath = {} as SkPath;
const KIT: RenderKit = {
  fill: stubPaint,
  stroke: stubPaint,
  numberFont: stubFont,
  paths: { spade: stubPath, heart: stubPath, diamond: stubPath, club: stubPath, rise: stubPath },
  labels: {},
};
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const TOKENS: readonly BoardToken[] = [
  'background',
  'well',
  'edge',
  'slot',
  'card',
  'rank',
  'spade',
  'heart',
  'diamond',
  'club',
  'burst',
  'onBurst',
  'warn',
  'onWarn',
  'hint',
];
const COLORS: BoardColors<BoardToken> = {
  scheme: 'dark',
  isColorBlind: false,
  color: Object.fromEntries(TOKENS.map((token) => [token, COLOR])) as Record<BoardToken, SkColor>,
};
const PERSIAN = { formatNumber: (value: number) => new Intl.NumberFormat('fa').format(value) };
const TURN = busiestBoardTurn();
const VIEW = toView(TURN.result.state, PERSIAN);
const TRACKS = buildTimeline(TURN.result.events, 'full');
const END_MS = timelineEndMs(TRACKS);

type DrawAt = {
  readonly tracks: readonly Track[];
  readonly atMs: number;
  readonly view?: PokerDropView;
  readonly highlight?: BoardHighlight;
  readonly kit?: RenderKit;
  readonly size?: { readonly width: number; readonly height: number };
};

function draw(at: DrawAt): Recorded {
  const { canvas, recorded } = recordingCanvas();
  const view = at.view ?? VIEW;
  const size = at.size ?? { width: 390, height: 560 };
  const layout =
    size.width > 0
      ? layoutBoard({ ...size, view, isMirrored: false })
      : { ...size, isMirrored: false, regions: [] };
  const fx = { ...sampleTimeline(at.tracks, at.atMs), pointer: IDLE_POINTER };
  const highlight = at.highlight ?? EMPTY_HIGHLIGHT;
  drawBoard(canvas, { view, fx, highlight, colors: COLORS, layout, kit: at.kit ?? KIT });
  return recorded;
}

function totalCalls(recorded: Recorded): number {
  return [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);
}

const MOMENTS = Array.from({ length: Math.ceil(END_MS / 25) + 1 }, (_, i) => i * 25);

describe('drawBoard', () => {
  it('stays within the draw-call budget on the busiest frame of the turn', () => {
    const frames = MOMENTS.map((atMs) => draw({ tracks: TRACKS, atMs }));
    expect(Math.max(...frames.map(totalCalls))).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
    // The particles and the badge draw at some moment of the turn.
    expect(Math.max(...frames.map((frame) => frame.calls.get('drawCircle') ?? 0))).toBeGreaterThan(
      10,
    );
  });

  it('shows at moment 0 the well before the move: no flash, badge or particle yet', () => {
    const recorded = draw({ tracks: TRACKS, atMs: 0 });
    expect(recorded.calls.get('drawLine')).toBeUndefined();
    expect(recorded.calls.get('drawCircle')).toBeUndefined();
    // 14 cards in the well, the card in hand on its way out, the next card waiting, the counter.
    expect(recorded.texts).toHaveLength(17);
  });

  it('draws the final view at the end: eight cards, the hand, the next card and the rise count', () => {
    const recorded = draw({ tracks: TRACKS, atMs: END_MS });
    expect(recorded.texts).toHaveLength(11);
    expect(recorded.texts.filter((text) => text === '9')).toHaveLength(3);
    expect(draw({ tracks: [], atMs: 0 }).texts).toStrictEqual(recorded.texts);
  });

  // spec 7.3: numbers drawn on boards follow the chosen digits; a two-digit label is below the
  // 0.1 % golden tolerance, so the recording canvas asserts it.
  it('draws the localised rise count and the cascade badge, which a pixel golden could miss', () => {
    expect(draw({ tracks: TRACKS, atMs: END_MS }).texts).toContain('۸');
    expect(draw({ tracks: TRACKS, atMs: 1255 }).texts).toContain('×۲');
    expect(draw({ tracks: TRACKS, atMs: 700 }).texts).not.toContain('×۲');
  });

  it('flashes each bursting line while its hand bursts', () => {
    expect(draw({ tracks: TRACKS, atMs: 500 }).calls.get('drawLine')).toBe(1);
    expect(draw({ tracks: TRACKS, atMs: 750 }).calls.get('drawLine')).toBeUndefined();
  });

  it('rings each hinted cell of the host highlight', () => {
    const hinted = [{ regionId: 'well', col: 2, row: 3 }];
    const plain = draw({ tracks: [], atMs: 0 });
    const withHint = draw({ tracks: [], atMs: 0, highlight: { selected: null, hinted } });
    expect(withHint.calls.get('drawRRect')).toBe((plain.calls.get('drawRRect') ?? 0) + 1);
  });

  it('outlines the well in the warning colour while a rising row overflows it', () => {
    const tracks = buildTimeline([{ kind: 'well-overflowed', atMs: 0 }], 'full');
    const plain = draw({ tracks: [], atMs: 0 });
    expect(draw({ tracks, atMs: 200 }).calls.get('drawRRect')).toBe(
      (plain.calls.get('drawRRect') ?? 0) + 1,
    );
  });

  // spec 8.10: the continue clears the top row; its cards lift out of the well and fade.
  it('keeps drawing the top row while the continue lifts it out, and not after', () => {
    const lost = { ...create(2, 0), cells: create(2, 0).cells.map((_, index) => index % 52) };
    const result = continueAfterLoss(lost);
    const view = toView(result.state, PERSIAN);
    const tracks = buildTimeline(result.events, 'full');
    const ranks = (atMs: number) => draw({ tracks, atMs, view }).texts.length;
    expect(ranks(200) - ranks(timelineEndMs(tracks))).toBe(5);
  });

  it('paints only the background before the canvas has a size', () => {
    const recorded = draw({ tracks: TRACKS, atMs: 500, size: { width: 0, height: 0 } });
    expect([...recorded.calls.entries()]).toStrictEqual([['drawColor', 1]]);
  });

  it('draws each suit as a shape even without the kit paths, and no text without the font', () => {
    const bare = { ...KIT, numberFont: null, paths: {} };
    const recorded = draw({ tracks: TRACKS, atMs: 1255, kit: bare });
    expect(recorded.texts).toStrictEqual([]);
    expect(recorded.calls.get('drawPath')).toBeUndefined();
    expect(recorded.calls.get('drawCircle')).toBeGreaterThan(10);
  });

  it('rings only hinted cells of the well', () => {
    const hinted = [{ regionId: 'strip', col: 0, row: 0 }];
    const plain = draw({ tracks: [], atMs: 0 });
    const other = draw({ tracks: [], atMs: 0, highlight: { selected: null, hinted } });
    expect(totalCalls(other)).toBe(totalCalls(plain));
  });

  it('shows the warning count when the next drop raises a row', () => {
    const view = { ...VIEW, riseDrops: 1, riseText: '۱' };
    expect(draw({ tracks: [], atMs: 0, view }).texts).toContain('۱');
  });
});
