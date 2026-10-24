// packages/shell/src/game-host/board-canvas.test.tsx
// no-shell-context: the canvas takes everything as props (the layout probe stays off). Skia renders
// as inert host elements in the unit project; the recorder and the gesture hook are recording
// stand-ins, so this proves what reaches draw() and the gesture layer.
import { act, render, screen } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';

import { BoardCanvas } from './board-canvas.tsx';
import { makeScene } from './board-scene.ts';
import { IDLE_POINTER } from './board-types.ts';
import { COACH_HAND_LOOP_MS } from './draw-coach-hand.ts';

import type {
  BoardColors,
  BoardHighlight,
  GameBoard,
  PointerSample,
  RenderKit,
} from './board-types.ts';
import type { BoardCoachHand } from './draw-coach-hand.ts';
import type { RecordInput } from './record-board.ts';
import type { BoardClock } from './use-board-clock.ts';
import type { BoardGestureHandlers } from './use-board-gestures.ts';
import type { SkColor } from '@shopify/react-native-skia';
import type { ReactNode } from 'react';
import type { Gesture } from 'react-native-gesture-handler';

type View = { readonly cells: number };

const mockRecorded: RecordInput<View, 'ink'>[] = [];
/** The phase of every picture recorded for the tutorial's hand. */
const mockHandPhases: number[] = [];
const mockHandlers: BoardGestureHandlers[] = [];

jest.mock('./record-board.ts', () => ({
  recordBoard: (_recorder: unknown, input: RecordInput<View, 'ink'>) => {
    mockRecorded.push(input);
    return null;
  },
  recordCoachHand: (_recorder: unknown, _hand: unknown, phase: number) => {
    mockHandPhases.push(phase);
    return null;
  },
}));
jest.mock('./use-board-gestures.ts', () => {
  const rngh = jest.requireActual<{ Gesture: typeof Gesture }>('react-native-gesture-handler');
  const types = jest.requireActual<{ IDLE_POINTER: PointerSample }>('./board-types.ts');
  return {
    useBoardGestures: (_layout: unknown, handlers: BoardGestureHandlers) => {
      mockHandlers.push(handlers);
      return { gesture: rngh.Gesture.Tap(), pointer: { get: () => types.IDLE_POINTER } };
    },
  };
});

const BOARD = {
  isMirroredInRtl: false,
  dragLiftPt: 40,
  layout: () => ({ width: 100, height: 100, isMirrored: false, regions: [] }),
  draw: jest.fn(),
} as unknown as GameBoard<unknown, View, 'ink'>;
const HIGHLIGHT: BoardHighlight = {
  selected: { regionId: 'tray', col: 1, row: 0 },
  hinted: [{ regionId: 'board', col: 3, row: 4 }],
};

/** One display frame: the first frame records both pictures before the hand starts gliding. */
const FRAME_MS = 16;
const INK = new Float32Array([0, 0, 0, 1]) as SkColor;
/** The tutorial's hand from tray slot 0 to the board's first cell. */
const HAND: BoardCoachHand = {
  hand: { from: { regionId: 'tray', col: 0, row: 0 }, to: { regionId: 'board', col: 0, row: 0 } },
  cells: [{ regionId: 'board', col: 0, row: 0 }],
  look: { fill: INK, ink: INK },
  targetRect: cellRect,
};

function Harness({ coach = null }: { readonly coach?: BoardCoachHand | null }): ReactNode {
  const scene = useSharedValue(makeScene(1, { cells: 4 }, []));
  const now = useSharedValue(0);
  const clock = { scene, now } as unknown as BoardClock<View>;
  return (
    <BoardCanvas
      board={BOARD}
      clock={clock}
      colors={{} as BoardColors<'ink'>}
      kit={{} as RenderKit}
      highlight={HIGHLIGHT}
      isRtl={false}
      panMode="drag"
      accessibilityLabel="3 monsters in the lanes, 2 hearts left"
      onIntent={jest.fn()}
      onHover={jest.fn()}
      onDrawError={jest.fn()}
      coach={coach}
      coachReplay={0}
      motion="full"
    />
  );
}

describe('BoardCanvas', () => {
  beforeEach(() => {
    mockRecorded.length = 0;
    mockHandPhases.length = 0;
    mockHandlers.length = 0;
  });

  it('is one accessible image named by the translated board summary', async () => {
    await render(<Harness />);
    expect(screen.getByRole('image')).toHaveProp(
      'accessibilityLabel',
      '3 monsters in the lanes, 2 hearts left',
    );
  });

  it('records the scene view with the pointer and the host highlight', async () => {
    await render(<Harness />);
    const last = mockRecorded.at(-1);
    expect(last?.scene.view).toStrictEqual({ cells: 4 });
    expect(last?.pointer).toStrictEqual(IDLE_POINTER);
    expect(last?.highlight).toBe(HIGHLIGHT);
  });

  it("hands the board's drag lift and pan mode to the gesture layer", async () => {
    await render(<Harness />);
    expect(mockHandlers.at(-1)).toMatchObject({ panMode: 'drag', dragLiftPt: 40 });
  });

  it("draws the tutorial's hand as its own picture, so its glide never records the board again", async () => {
    // Spec S13: the pointing hand glides from the slot to the gap. Only the hand's own picture
    // follows its phase; the board's picture is recorded for the scene and the finger alone.
    jest.useFakeTimers();
    await render(<Harness coach={HAND} />);
    await act(() => {
      jest.advanceTimersByTime(FRAME_MS);
    });
    const [boardRecords, handRecords] = [mockRecorded.length, mockHandPhases.length];
    await act(() => {
      jest.advanceTimersByTime(COACH_HAND_LOOP_MS);
    });
    expect(mockRecorded).toHaveLength(boardRecords);
    expect(mockHandPhases.length).toBeGreaterThan(handRecords + 2);
    jest.useRealTimers();
  });
});
