// apps/line-siege/src/board/draw-board.test.ts
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { LineSiegeView } from './to-view.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { LineSiegeEvent } from '@e07/line-siege/rules/line-siege-types.ts';
import type {
  BoardColors,
  BoardHighlight,
  PointerSample,
  RenderKit,
} from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint, SkPath } from '@shopify/react-native-skia';

/** Per-game ceiling of canvas calls on the busiest frame (the Shell-wide cap is 1000). */
const DRAW_CALL_BUDGET = 400;

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
  getGlyphIDs: () => [1, 2],
  getGlyphWidths: () => [8, 8],
  getSize: () => 16,
} as unknown as SkFont;
const stubPaint = new Proxy({}, { get: () => () => undefined }) as SkPaint;
const KIT: RenderKit = {
  fill: stubPaint,
  stroke: stubPaint,
  numberFont: stubFont,
  paths: { arrow: {} as SkPath, heart: {} as SkPath },
  labels: {},
};
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const TOKENS: readonly BoardToken[] = [
  'background',
  'lane',
  'wall',
  'cell',
  'block',
  'ghost',
  'beam',
  'shock',
  'number',
  'tray',
  'heart',
  'normal',
  'armoured',
  'fast',
];
const COLORS: BoardColors<BoardToken> = {
  scheme: 'dark',
  isColorBlind: false,
  color: Object.fromEntries(TOKENS.map((token) => [token, COLOR])) as Record<BoardToken, SkColor>,
};
const VIEW: LineSiegeView = {
  size: 8,
  laneRows: 6,
  cells: Array.from({ length: 64 }, (_, i) => (i % 3 === 0 ? 1 : 0)),
  monsters: [
    { id: 2, kind: 'normal', lane: 1, row: 4, hpText: '3' },
    { id: 3, kind: 'armoured', lane: 4, row: 1, hpText: '9' },
    { id: 4, kind: 'fast', lane: 6, row: 0, hpText: '5' },
  ],
  tray: [
    [0, 0, 1, 0, 0, 1, 1, 1],
    [0, 0],
    [0, 0, 1, 0, 2, 0, 1, 1],
  ],
  hearts: 2,
  maxHearts: 3,
};
const LAYOUT = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });
/** The busiest turn: a row and a column clear, a defeat with its burst, a march and a breach. */
const BUSIEST: readonly LineSiegeEvent[] = [
  { kind: 'block-placed', trayIndex: 1, piece: 2, cells: [31, 39] },
  { kind: 'row-cleared', row: 4 },
  { kind: 'column-cleared', col: 7 },
  { kind: 'beam-fired', lane: 7, targetId: 1 },
  { kind: 'monster-hit', monsterId: 1, damage: 8, hpLeft: 0 },
  { kind: 'shockwave-sent', rows: 1, damage: 2 },
  { kind: 'monster-defeated', monsterId: 1, monsterKind: 'normal', lane: 7, row: 2 },
  { kind: 'monster-moved', monsterId: 5, fromRow: 5, toRow: 6 },
  { kind: 'wall-breached', monsterId: 5, monsterKind: 'fast', lane: 3, heartsLeft: 2 },
  { kind: 'monster-spawned', monsterId: 4, monsterKind: 'fast', lane: 6, hp: 5 },
];

type DrawInput = {
  readonly atMs: number;
  readonly pointer?: PointerSample;
  readonly highlight?: BoardHighlight;
  readonly view?: LineSiegeView;
  readonly events?: readonly LineSiegeEvent[];
  readonly tracks?: readonly Track[];
};

function drawAt(input: DrawInput): Recorded {
  const tracks = input.tracks ?? buildTimeline(input.events ?? BUSIEST, 'full');
  const fx = { ...sampleTimeline(tracks, input.atMs), pointer: input.pointer ?? IDLE_POINTER };
  const { canvas, recorded } = recordingCanvas();
  const highlight = input.highlight ?? EMPTY_HIGHLIGHT;
  const frame = { view: input.view ?? VIEW, fx, highlight, colors: COLORS, layout: LAYOUT };
  drawBoard(canvas, { ...frame, kit: KIT });
  return recorded;
}

const count = (recorded: Recorded, name: string): number => recorded.calls.get(name) ?? 0;
const totalCalls = (recorded: Recorded): number =>
  [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);

describe('drawBoard', () => {
  it('stays within the draw-call budget on the busiest frames of a turn', () => {
    const frames = [200, 300, 500, 650, 700].map((atMs) => drawAt({ atMs }));
    expect(count(drawAt({ atMs: 500 }), 'drawCircle')).toBeGreaterThan(1);
    expect(Math.max(...frames.map(totalCalls))).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('shows at moment 0 no effect that starts later (beam, waves, flash, burst, shake)', () => {
    const tracks = buildTimeline(BUSIEST, 'full');
    const effects = new Set(['beam', 'shock', 'push', 'flash', 'burst', 'shake']);
    const withoutEffects = tracks.filter((track) => !effects.has(track.channel));
    // Effects are not tweens of something already visible: before their track starts they draw
    // nothing, so moment 0 looks exactly as if the effects did not exist.
    expect(drawAt({ atMs: 0, tracks }).calls).toStrictEqual(
      drawAt({ atMs: 0, tracks: withoutEffects }).calls,
    );
    expect(drawAt({ atMs: 500, tracks }).calls).not.toStrictEqual(
      drawAt({ atMs: 500, tracks: withoutEffects }).calls,
    );
  });

  it('draws every localised health label, which a 0.1 % pixel golden could miss', () => {
    const monsters = [{ id: 2, kind: 'normal' as const, lane: 1, row: 4, hpText: '۱۲' }];
    expect(drawAt({ atMs: 2000, view: { ...VIEW, monsters } }).texts).toStrictEqual(['۱۲']);
  });

  it('draws every heart slot on the wall, filled for the hearts left', () => {
    const settled = drawAt({ atMs: 5000, events: [] });
    const noHearts = drawAt({ atMs: 5000, events: [], view: { ...VIEW, hearts: 0 } });
    // Each slot draws its outline; each heart left also draws its filled shape.
    expect(count(settled, 'drawPath') - count(noHearts, 'drawPath')).toBe(2);
  });

  it('draws the dragged block as a ghost only while it hovers a board cell', () => {
    const dragging = {
      ...IDLE_POINTER,
      isDown: true,
      dragFrom: { regionId: 'tray', col: 0, row: 0 },
      hover: { regionId: 'board', col: 2, row: 2 },
    };
    const offBoard = { ...dragging, hover: { regionId: 'tray', col: 1, row: 0 } };
    const idle = totalCalls(drawAt({ atMs: 2000 }));
    // Four blocks, each a fill and an ink edge.
    expect(totalCalls(drawAt({ atMs: 2000, pointer: dragging }))).toBe(idle + 8);
    expect(totalCalls(drawAt({ atMs: 2000, pointer: offBoard }))).toBe(idle);
  });

  it('rings the selected tray slot and marks the hinted move from the host highlight', () => {
    const plain = drawAt({ atMs: 2000 });
    const selected = { selected: { regionId: 'tray', col: 1, row: 0 }, hinted: [] };
    const hinted = {
      selected: null,
      hinted: [
        { regionId: 'tray', col: 2, row: 0 },
        { regionId: 'board', col: 3, row: 3 },
        { regionId: 'board', col: 4, row: 3 },
      ],
    };
    expect(count(drawAt({ atMs: 2000, highlight: selected }), 'drawRRect')).toBe(
      count(plain, 'drawRRect') + 1,
    );
    expect(count(drawAt({ atMs: 2000, highlight: hinted }), 'drawRRect')).toBe(
      count(plain, 'drawRRect') + 5,
    );
  });

  it('pops a restored heart and sweeps the lanes when the continue pushes the monsters back', () => {
    const events: LineSiegeEvent[] = [
      { kind: 'heart-restored', hearts: 1 },
      { kind: 'monsters-pushed-back', rows: 3 },
      { kind: 'rows-emptied', rows: [6, 7] },
    ];
    const view = { ...VIEW, hearts: 1 };
    const during = drawAt({ atMs: 150, events, view });
    const after = drawAt({ atMs: 5000, events, view });
    expect(count(during, 'drawRect')).toBe(count(after, 'drawRect') + 1);
  });

  it('skips digits without a number font and the shapes without their paths', () => {
    const bare = { ...KIT, numberFont: null, paths: {} };
    const fx = { ...sampleTimeline([], 0), pointer: IDLE_POINTER };
    const { canvas, recorded } = recordingCanvas();
    const frame = { view: VIEW, fx, highlight: EMPTY_HIGHLIGHT, colors: COLORS, layout: LAYOUT };
    drawBoard(canvas, { ...frame, kit: bare });
    expect([recorded.texts, recorded.calls.get('drawPath')]).toStrictEqual([[], undefined]);
  });

  it('draws nothing but the background before the canvas has a size', () => {
    const empty = { width: 0, height: 0, isMirrored: false, regions: [] };
    const fx = { ...sampleTimeline(buildTimeline(BUSIEST, 'full'), 500), pointer: IDLE_POINTER };
    const { canvas, recorded } = recordingCanvas();
    const frame = { view: VIEW, fx, highlight: EMPTY_HIGHLIGHT, colors: COLORS, layout: empty };
    drawBoard(canvas, { ...frame, kit: KIT });
    expect(recorded.calls.get('drawRRect')).toBeUndefined();
  });
});
