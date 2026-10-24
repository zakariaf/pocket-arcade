// packages/shell/src/game-host/record-board.test.ts
import { cellRect } from '@e07/game-kit/geom/board-layout.ts';

import { makeScene } from './board-scene.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from './board-types.ts';
import { coachHandGlide } from './draw-coach-hand.ts';
import { recordBoard, recordCoachHand } from './record-board.ts';

import type { BoardColors, DrawFrame, RenderKit } from './board-types.ts';
import type { RecordInput } from './record-board.ts';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type {
  SkCanvas,
  SkColor,
  SkPaint,
  SkPicture,
  SkPictureRecorder,
  SkRRect,
} from '@shopify/react-native-skia';

type View = { readonly label: string };
type Frame = DrawFrame<View, 'ink'>;

const LAYOUT: BoardLayout = { width: 200, height: 100, isMirrored: false, regions: [] };
const CANVAS = { name: 'canvas' } as unknown as SkCanvas;
const PICTURE = { name: 'picture' } as unknown as SkPicture;
const POP: Track = {
  channel: 'pop',
  entityId: 1,
  startMs: 0,
  durationMs: 100,
  easing: 'linear',
  from: [0],
  to: [1],
};

/** A recorder that hands out CANVAS, remembers the bounds and returns PICTURE. */
function fakeRecorder(): { recorder: SkPictureRecorder; bounds: unknown[] } {
  const bounds: unknown[] = [];
  const recorder = {
    beginRecording: (rect: unknown) => {
      bounds.push(rect);
      return CANVAS;
    },
    finishRecordingAsPicture: () => PICTURE,
  } as unknown as SkPictureRecorder;
  return { recorder, bounds };
}

function input(draw: (canvas: SkCanvas, frame: Frame) => void): RecordInput<View, 'ink'> {
  const scene = { ...makeScene(3, { label: 'final' }, [POP]), startAt: 1000 };
  return {
    scene,
    now: 1050,
    layout: LAYOUT,
    pointer: { ...IDLE_POINTER, isDown: true },
    highlight: { selected: { regionId: 'tray', col: 1, row: 0 }, hinted: [] },
    colors: {} as BoardColors<'ink'>,
    kit: {} as RenderKit,
    draw,
    onError: jest.fn(),
    restingHand: null,
  };
}

describe('recordBoard', () => {
  it('records one frame of the final view at the scene time, with pointer and highlight', () => {
    const frames: Frame[] = [];
    const { recorder, bounds } = fakeRecorder();
    const picture = recordBoard(
      recorder,
      input((canvas, frame) => {
        expect(canvas).toBe(CANVAS);
        frames.push(frame);
      }),
    );
    expect(picture).toBe(PICTURE);
    expect(bounds).toStrictEqual([{ x: 0, y: 0, width: 200, height: 100 }]);
    const [frame] = frames;
    expect(frame?.view).toStrictEqual({ label: 'final' });
    expect(frame?.fx.elapsedMs).toBe(50);
    expect(frame?.fx.entries['pop:1']?.values).toStrictEqual([0.5]);
    expect(frame?.fx.pointer.isDown).toBe(true);
    expect(frame?.highlight.selected).toStrictEqual({ regionId: 'tray', col: 1, row: 0 });
    expect(frame?.layout).toBe(LAYOUT);
  });

  it('reports a draw() error and still returns a picture (the app never crashes)', () => {
    const failing = input(() => {
      throw new Error('bad token');
    });
    const picture = recordBoard(fakeRecorder().recorder, {
      ...failing,
      highlight: EMPTY_HIGHLIGHT,
    });
    expect(picture).toBe(PICTURE);
    expect(failing.onError).toHaveBeenCalledWith('Error: bad token');
  });

  it("draws the tutorial's pointing hand over the game's picture, on the same canvas", () => {
    // Spec S13: the pointing hand guides the first move; the Shell draws it for every game.
    const calls: string[] = [];
    const canvas = new Proxy(
      {},
      {
        get: (_target, name) => () => {
          calls.push(String(name));
        },
      },
    ) as SkCanvas;
    const recorder = {
      beginRecording: () => canvas,
      finishRecordingAsPicture: () => PICTURE,
    } as unknown as SkPictureRecorder;
    const paint = new Proxy({}, { get: () => () => undefined });
    const cell = { regionId: 'board', col: 0, row: 0 };
    const layout = {
      ...LAYOUT,
      regions: [{ id: 'board', x: 0, y: 0, cell: 40, cols: 2, rows: 2 }],
    };
    const restingHand = {
      hand: { from: null, to: cell },
      cells: [cell],
      look: { fill: new Float32Array(4), ink: new Float32Array(4) },
      targetRect: cellRect,
    };
    recordBoard(recorder, {
      ...input(() => {
        calls.push('game');
      }),
      layout,
      kit: { fill: paint, stroke: paint } as unknown as RenderKit,
      restingHand,
    });
    expect(calls).toStrictEqual(['game', ...Array.from({ length: 6 }, () => 'drawRRect')]);
  });
});

describe('recordCoachHand', () => {
  /** A 2 x 2 board of 40 pt cells at the origin and one 40 pt tray slot beside it. */
  const HAND_LAYOUT: BoardLayout = {
    ...LAYOUT,
    regions: [
      { id: 'board', x: 0, y: 0, cell: 40, cols: 2, rows: 2 },
      { id: 'tray', x: 100, y: 0, cell: 40, cols: 1, rows: 1 },
    ],
  };
  const SLOT = { regionId: 'tray', col: 0, row: 0 };
  const CELL = { regionId: 'board', col: 0, row: 0 };

  /** Records the hand from the slot to the first cell at `phase`: its bounds and its finger. */
  function recordAt(phase: number) {
    const rrects: SkRRect[] = [];
    const bounds: unknown[] = [];
    const canvas = new Proxy(
      {},
      {
        get: (_target, name) => (rrect: SkRRect) => {
          if (name === 'drawRRect') rrects.push(rrect);
        },
      },
    ) as SkCanvas;
    const recorder = {
      beginRecording: (rect: unknown) => {
        bounds.push(rect);
        return canvas;
      },
      finishRecordingAsPicture: () => PICTURE,
    } as unknown as SkPictureRecorder;
    const paint = new Proxy({}, { get: () => () => undefined }) as SkPaint;
    const ink = new Float32Array([0, 0, 0, 1]) as SkColor;
    const glide = coachHandGlide(HAND_LAYOUT, {
      hand: { from: SLOT, to: CELL },
      cells: [SLOT, CELL],
    });
    const hand = {
      layout: HAND_LAYOUT,
      glide,
      look: { fill: ink, ink },
      kit: { fill: paint, stroke: paint },
    };
    const picture = recordCoachHand(recorder, hand, phase);
    return { picture, bounds, finger: rrects.at(-1)?.rect };
  }

  it("records the tutorial's hand as its own picture, placed at the phase it is given", () => {
    // Spec S13: the pointing hand glides from the slot to the gap. As it glides, only this
    // picture is recorded again, over the board's (BoardCanvas draws it as its own layer).
    const start = recordAt(0);
    expect([start.picture, start.bounds]).toStrictEqual([
      PICTURE,
      [{ x: 0, y: 0, width: 200, height: 100 }],
    ]);
    expect(start.finger?.x).toBeCloseTo(120 - 0.14 * 40, 6);
    expect(start.finger?.y).toBeCloseTo(20, 6);
    const end = recordAt(1);
    expect(end.finger?.x).toBeCloseTo(20 - 0.14 * 40, 6);
    expect(end.finger?.y).toBeCloseTo(28, 6);
  });
});
