// apps/line-siege/src/board/draw-hinted.test.ts
import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { LINE_SIEGE_TEACHING } from '@e07/line-siege/tutorial/line-siege-teaching.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { LineSiegeView } from './to-view.ts';
import type { BoardTarget, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type {
  BoardColors,
  BoardHighlight,
  PointerSample,
  RenderKit,
} from '@e07/shell/game-host/board-types.ts';
import type {
  SkCanvas,
  SkColor,
  SkFont,
  SkPaint,
  SkPath,
  SkRRect,
} from '@shopify/react-native-skia';

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
/** The palette's own alphas where it has one (board-palettes.json: ghost 80, cell 59, shock B3). */
const OWN_ALPHA: Partial<Record<BoardToken, number>> = { ghost: 0.5, cell: 0.35, shock: 0.7 };
/** Each token its own colour; red carries the token's index so a paint's colour names its token. */
const COLORS: BoardColors<BoardToken> = {
  scheme: 'light',
  isColorBlind: false,
  color: Object.fromEntries(
    TOKENS.map((token, i) => [
      token,
      new Float32Array([i / 100, 0, 0, OWN_ALPHA[token] ?? 1]) as SkColor,
    ]),
  ) as Record<BoardToken, SkColor>,
};

/** A paint that keeps what Skia keeps: setColor sets the colour and its alpha, setAlphaf the alpha. */
type FakePaint = { token: BoardToken | null; alpha: number };

function fakePaint(): { readonly paint: SkPaint; readonly state: FakePaint } {
  const state: FakePaint = { token: null, alpha: 1 };
  const setColor = (color: SkColor): void => {
    state.token = TOKENS[Math.round((color[0] ?? 0) * 100)] ?? null;
    state.alpha = color[3] ?? 1;
  };
  const setAlphaf = (alpha: number): void => {
    state.alpha = alpha;
  };
  const methods: Record<string, unknown> = { setColor, setAlphaf };
  const paint = new Proxy(
    {},
    { get: (_target, name) => methods[String(name)] ?? (() => undefined) },
  ) as SkPaint;
  return { paint, state };
}

type Painted = {
  readonly rect: Rect;
  readonly isStroke: boolean;
  readonly token: BoardToken | null;
  readonly alpha: number;
};

type Recording = {
  readonly kit: RenderKit;
  readonly canvas: SkCanvas;
  readonly painted: Painted[];
};

function recording(): Recording {
  const { paint: fillPaint, state: fill } = fakePaint();
  const { paint: strokePaint, state: stroke } = fakePaint();
  const painted: Painted[] = [];
  const drawRRect = (rrect: SkRRect, paint: SkPaint): void => {
    const state = paint === strokePaint ? stroke : fill;
    painted.push({ rect: rrect.rect, isStroke: paint === strokePaint, ...state });
  };
  const methods: Record<string, unknown> = { drawRRect };
  const canvas = new Proxy(
    {},
    { get: (_target, name) => methods[String(name)] ?? (() => undefined) },
  ) as SkCanvas;
  const font = { getGlyphIDs: () => [1], getGlyphWidths: () => [8], getSize: () => 16 };
  const kit: RenderKit = {
    fill: fillPaint,
    stroke: strokePaint,
    numberFont: font as unknown as SkFont,
    paths: { arrow: {} as SkPath, heart: {} as SkPath },
    labels: {},
  };
  return { kit, canvas, painted };
}

const START = toView(LINE_SIEGE_TEACHING.tutorial.start, { formatNumber: String });
const LAYOUT = layoutBoard({ width: 402, height: 560, view: START, isMirrored: false });
/** Step 1's gap: column 7, rows 3 and 4, which the vertical two of tray slot 1 fills. */
const GAP: readonly BoardTarget[] = [
  { regionId: 'board', col: 7, row: 3 },
  { regionId: 'board', col: 7, row: 4 },
];
const COACHED: BoardHighlight = {
  selected: null,
  hinted: [{ regionId: 'tray', col: 1, row: 0 }, ...GAP],
};

function draw(input: {
  readonly view?: LineSiegeView;
  readonly highlight?: BoardHighlight;
  readonly pointer?: PointerSample;
}): Painted[] {
  const { kit, canvas, painted } = recording();
  const fx = { ...sampleTimeline([], 0), pointer: input.pointer ?? IDLE_POINTER };
  const view = input.view ?? START;
  const highlight = input.highlight ?? EMPTY_HIGHLIGHT;
  drawBoard(canvas, { view, fx, highlight, colors: COLORS, layout: LAYOUT, kit });
  return painted;
}

function isInside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** What was painted inside one board cell. */
function paintedIn(painted: readonly Painted[], target: BoardTarget): Painted[] {
  const cell = cellRect(LAYOUT, target);
  if (cell === null) throw new Error(`no cell ${JSON.stringify(target)}`);
  return painted.filter((entry) => isInside(entry.rect, cell));
}

/**
 * A placed block's look: an opaque fill in the block colour (the ghost token IS the block colour
 * at half alpha, so an opaque ghost looks exactly like a placed block).
 */
const isBlockFill = (entry: Painted): boolean =>
  !entry.isStroke && (entry.token === 'block' || entry.token === 'ghost') && entry.alpha >= 0.99;

function emptyCells(view: LineSiegeView): BoardTarget[] {
  return view.cells.flatMap((value, i) =>
    value === 1 ? [] : [{ regionId: 'board', col: i % view.size, row: Math.floor(i / view.size) }],
  );
}

describe('the tutorial pointer on the Line Siege board', () => {
  it("paints no block on an empty cell of the tutorial's first board, with the pointer on", () => {
    // Spec S13: the game guides the first move with a pointer. The gap it points at is EMPTY:
    // a hinted cell drawn like a placed block (opaque block colour, ink edge) told the player the
    // gap was one cell, where the vertical two could not fit (Android and iOS, 2026-10-18).
    const painted = draw({ highlight: COACHED });
    const empty = emptyCells(START);
    expect(empty).toStrictEqual(expect.arrayContaining([...GAP]));
    expect(empty.filter((cell) => paintedIn(painted, cell).some(isBlockFill))).toStrictEqual([]);
  });

  it('outlines each coached cell hollow in the block colour, never with the ink edge', () => {
    const painted = draw({ highlight: COACHED });
    const looks = GAP.map((cell) => {
      const inCell = paintedIn(painted, cell);
      return {
        outline: inCell.some((entry) => entry.isStroke && entry.token === 'block'),
        inkEdge: inCell.some((entry) => entry.isStroke && entry.token === 'wall'),
        isFaint: inCell.every((entry) => entry.isStroke || entry.alpha <= 0.5),
      };
    });
    expect(looks).toStrictEqual([
      { outline: true, inkEdge: false, isFaint: true },
      { outline: true, inkEdge: false, isFaint: true },
    ]);
  });

  it('draws a dragged block as the translucent ghost of the palette, not as placed blocks', () => {
    const dragging = {
      ...IDLE_POINTER,
      isDown: true,
      dragFrom: { regionId: 'tray', col: 1, row: 0 },
      hover: GAP[0] ?? null,
    };
    const fills = GAP.flatMap((cell) =>
      paintedIn(draw({ pointer: dragging }), cell).filter((entry) => entry.token === 'ghost'),
    );
    expect(fills.map((entry) => entry.alpha)).toStrictEqual([0.5, 0.5]);
  });
});
