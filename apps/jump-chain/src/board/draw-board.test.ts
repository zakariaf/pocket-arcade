// apps/jump-chain/src/board/draw-board.test.ts
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { applyMove } from '@e07/jump-chain/rules/apply-move.ts';
import { create } from '@e07/jump-chain/rules/create.ts';
import { listMoves } from '@e07/jump-chain/rules/list-moves.ts';
import { moveEndingAt } from '@e07/jump-chain/rules/move-ends.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { JumpChainView } from './to-view.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { JumpChainState, Square } from '@e07/jump-chain/rules/jump-chain-types.ts';
import type {
  BoardColors,
  BoardHighlight,
  PointerSample,
  RenderKit,
} from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint, SkPath } from '@shopify/react-native-skia';

/** Per-game ceiling of canvas calls on the busiest frame (the Shell-wide cap is 1000). */
const DRAW_CALL_BUDGET = 400;
/** Channels that are effects, not tweens of something visible: they wait for their track. */
const EFFECTS = new Set(['burst', 'clear', 'breach']);
const PERSIAN = { formatNumber: (value: number) => new Intl.NumberFormat('fa').format(value) };

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
const COLORS = {
  scheme: 'dark',
  isColorBlind: false,
  color: new Proxy({}, { get: () => COLOR }),
} as unknown as BoardColors<BoardToken>;

function position(
  piece: Square,
  enemySquares: readonly (readonly [number, number, number])[],
): JumpChainState {
  const enemies = enemySquares.map(([col, row, rank], id) => ({ id, rank, col, row }));
  return { ...create(1, 0), piece, enemies, total: enemies.length, nextId: enemies.length };
}

/** A four-jump chain that clears the front rank and ends where it began; then the ranks advance. */
const BEFORE: JumpChainState = {
  ...position({ col: 2, row: 6 }, [
    [1, 5, 0],
    [3, 5, 0],
    [1, 3, 0],
    [3, 3, 0],
    [5, 3, 1],
    [5, 1, 1],
    [1, -1, 1],
  ]),
  marchIn: 1,
};
const CHAIN = moveEndingAt(BEFORE, { col: 2, row: 6 });
if (CHAIN === null) throw new Error('the chain is not listed');
const RESULT = applyMove(BEFORE, CHAIN);
const VIEW = toView(RESULT.state, PERSIAN);
const TRACKS = buildTimeline(RESULT.events, 'full');
const LAYOUT = layoutBoard({ width: 374, height: 660, view: VIEW, isMirrored: false });

type DrawAt = {
  readonly tracks: readonly Track[];
  readonly atMs: number;
  readonly view?: JumpChainView;
  readonly highlight?: BoardHighlight;
  readonly pointer?: PointerSample;
  readonly kit?: RenderKit;
};

function draw(at: DrawAt): Recorded {
  const { canvas, recorded } = recordingCanvas();
  const fx = { ...sampleTimeline(at.tracks, at.atMs), pointer: at.pointer ?? IDLE_POINTER };
  const highlight = at.highlight ?? EMPTY_HIGHLIGHT;
  const view = at.view ?? VIEW;
  drawBoard(canvas, { view, fx, highlight, colors: COLORS, layout: LAYOUT, kit: at.kit ?? KIT });
  return recorded;
}

function totalCalls(recorded: Recorded): number {
  return [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);
}

function count(recorded: Recorded, name: string): number {
  return recorded.calls.get(name) ?? 0;
}

/** The pointer of a finger dragging the piece at `from` with its lifted point over `hover`. */
function dragging(from: Square, hover: Square | null): PointerSample {
  return {
    isDown: true,
    x: 0,
    y: 0,
    hover: hover === null ? null : { regionId: 'board', ...hover },
    dragFrom: { regionId: 'board', ...from },
  };
}

describe('drawBoard', () => {
  it('stays within the draw-call budget on every frame of the busiest turn', () => {
    const endMs = timelineEndMs(TRACKS);
    const frames = Array.from({ length: Math.ceil(endMs / 16) + 1 }, (_, index) =>
      totalCalls(draw({ tracks: TRACKS, atMs: index * 16 })),
    );
    expect(Math.max(...frames)).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
    const preview = draw({
      tracks: [],
      atMs: 0,
      view: toView(BEFORE, PERSIAN),
      pointer: dragging({ col: 2, row: 6 }, { col: 2, row: 6 }),
    });
    expect(totalCalls(preview)).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
  });

  it('shows at moment 0 no effect that starts later (bursts, glow and flashes wait)', () => {
    const atZero = draw({ tracks: TRACKS, atMs: 0 });
    const plain = TRACKS.filter((track) => !EFFECTS.has(track.channel));
    expect(totalCalls(atZero)).toBe(totalCalls(draw({ tracks: plain, atMs: 0 })));
    const midChain = TRACKS.find((track) => track.channel === 'burst')?.startMs ?? 0;
    expect(totalCalls(draw({ tracks: TRACKS, atMs: midChain + 100 }))).toBeGreaterThan(
      totalCalls(draw({ tracks: plain, atMs: midChain + 100 })),
    );
  });

  it('keeps the jumped enemies on the board until the piece passes them', () => {
    const atZero = draw({ tracks: TRACKS, atMs: 0 });
    const final = draw({ tracks: [], atMs: 0 });
    expect(count(atZero, 'drawCircle')).toBeGreaterThan(count(final, 'drawCircle'));
  });

  it('draws the localised march countdown, which a 0.1 % golden could miss', () => {
    expect(draw({ tracks: [], atMs: 0 }).texts).toStrictEqual(['۶']);
  });

  it('hides the march countdown and the targets once the run is over', () => {
    const won = toView({ ...RESULT.state, enemies: [] }, PERSIAN);
    const recorded = draw({ tracks: [], atMs: 0, view: won });
    expect(recorded.texts).toStrictEqual([]);
    expect(count(recorded, 'drawCircle')).toBeLessThan(
      count(draw({ tracks: [], atMs: 0 }), 'drawCircle'),
    );
  });

  it('rings each hinted square of the host highlight', () => {
    const hinted = [{ regionId: 'board', col: 2, row: 6 }];
    const plain = draw({ tracks: [], atMs: 0 });
    const withHint = draw({ tracks: [], atMs: 0, highlight: { selected: null, hinted } });
    expect(count(withHint, 'drawCircle')).toBe(count(plain, 'drawCircle') + 1);
  });

  it('previews the chain a dragging finger would play: its path, its captures and a ghost', () => {
    const view = toView(BEFORE, PERSIAN);
    const idle = draw({ tracks: [], atMs: 0, view });
    const preview = draw({
      tracks: [],
      atMs: 0,
      view,
      pointer: dragging({ col: 2, row: 6 }, { col: 2, row: 6 }),
    });
    expect(count(preview, 'drawLine') - count(idle, 'drawLine')).toBe(4);
    expect(count(preview, 'drawCircle') - count(idle, 'drawCircle')).toBeGreaterThanOrEqual(5);
  });

  it('previews nothing over a square no move ends on, or for a drag that did not start on the piece', () => {
    const view = toView(BEFORE, PERSIAN);
    const idle = totalCalls(draw({ tracks: [], atMs: 0, view }));
    const offTarget = dragging({ col: 2, row: 6 }, { col: 3, row: 5 });
    const offPiece = dragging({ col: 4, row: 6 }, { col: 2, row: 6 });
    expect(totalCalls(draw({ tracks: [], atMs: 0, view, pointer: offTarget }))).toBe(idle);
    expect(totalCalls(draw({ tracks: [], atMs: 0, view, pointer: offPiece }))).toBe(idle);
  });

  it('flashes an enemy that reached your side while its flash plays', () => {
    const near: JumpChainState = {
      ...position({ col: 3, row: 3 }, [
        [1, 7, 0],
        [5, 1, 1],
      ]),
      marchIn: 1,
    };
    const [step] = listMoves(near);
    if (step === undefined) throw new Error('no move');
    const lost = applyMove(near, step);
    expect(lost.events.at(-1)?.kind).toBe('side-reached');
    const tracks = buildTimeline(lost.events, 'full');
    const flashAt = tracks.find((track) => track.channel === 'breach')?.startMs ?? 0;
    const view = toView(lost.state, PERSIAN);
    const during = draw({ tracks, atMs: flashAt + 100, view });
    const after = draw({ tracks: [], atMs: 0, view });
    expect(count(during, 'drawCircle')).toBe(count(after, 'drawCircle') + 1);
  });

  it('draws your piece’s crown from the kit’s unit path, and its ghost’s too', () => {
    const kit = { ...KIT, paths: { crown: {} as SkPath } };
    expect(count(draw({ tracks: [], atMs: 0, kit }), 'drawPath')).toBe(1);
    const preview = draw({
      tracks: [],
      atMs: 0,
      kit,
      view: toView(BEFORE, PERSIAN),
      pointer: dragging({ col: 2, row: 6 }, { col: 2, row: 6 }),
    });
    expect(count(preview, 'drawPath')).toBe(2);
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
  const colors = {
    ...COLORS,
    color: new Proxy({}, { get: (_target, name) => (name === at.token ? color : COLOR) }),
  } as unknown as BoardColors<BoardToken>;
  const fx = { ...sampleTimeline(at.tracks, at.atMs), pointer: at.pointer ?? IDLE_POINTER };
  const kit = { ...(at.kit ?? KIT), [at.paint]: probe.paint };
  const view = at.view ?? VIEW;
  drawBoard(canvas, { view, fx, highlight: EMPTY_HIGHLIGHT, colors, layout: LAYOUT, kit });
  return seen;
}

describe('drawBoard with a translucent token', () => {
  const startOf = (tracks: readonly Track[], channel: string): number =>
    tracks.find((track) => track.channel === channel)?.startMs ?? 0;
  const ghost = {
    tracks: [],
    atMs: 0,
    view: toView(BEFORE, PERSIAN),
    pointer: dragging({ col: 2, row: 6 }, { col: 2, row: 6 }),
  };
  const near: JumpChainState = {
    ...position({ col: 3, row: 3 }, [
      [1, 7, 0],
      [5, 1, 1],
    ]),
    marchIn: 1,
  };
  const [step] = listMoves(near);
  if (step === undefined) throw new Error('no move');
  const lost = applyMove(near, step);
  const lostTracks = buildTimeline(lost.events, 'full');
  const cases: readonly (TokenAt & { readonly name: string })[] = [
    { name: 'the ghost piece', token: 'piece', paint: 'fill', call: 'drawCircle', ...ghost },
    { name: 'its ink edge', token: 'edge', paint: 'stroke', call: 'drawCircle', ...ghost },
    { name: 'its crown', token: 'crown', paint: 'fill', call: 'drawCircle', ...ghost },
    {
      name: 'the capture burst',
      token: 'capture',
      paint: 'fill',
      call: 'drawCircle',
      tracks: TRACKS,
      atMs: startOf(TRACKS, 'burst') + 100,
    },
    {
      name: 'the rank-clear glow',
      token: 'glow',
      paint: 'fill',
      call: 'drawRect',
      tracks: TRACKS,
      atMs: startOf(TRACKS, 'clear') + 60,
    },
    {
      name: 'the breach flash',
      token: 'breach',
      paint: 'fill',
      call: 'drawCircle',
      tracks: lostTracks,
      atMs: startOf(lostTracks, 'breach') + 100,
      view: toView(lost.state, PERSIAN),
    },
  ];

  // Spec 8.12: the board draws from its palette tokens, so a token's own alpha must survive a fade.
  it.each(cases)('keeps the token alpha under the fade of $name', (at) => {
    const opaque = tokenAlphas(at, 1);
    expect(opaque.filter((alpha) => alpha > 0 && alpha < 1).length).toBeGreaterThan(0);
    expect(tokenAlphas(at, 0.5)).toStrictEqual(opaque.map((alpha) => alpha * 0.5));
  });
});
