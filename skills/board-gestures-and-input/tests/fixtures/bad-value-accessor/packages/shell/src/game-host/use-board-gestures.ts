// packages/shell/src/game-host/use-board-gestures.ts
// The ONLY file that imports gesture builders from react-native-gesture-handler.
// RNGH 2.32 builder API (Expo SDK 57). Moving to the v3 hook API rewrites this file only.
// Every gesture yields at most ONE InputIntent; legality is decided later by the game's intentToMove.
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { hitTest, isSameTarget } from '@e07/game-kit/geom/board-layout.ts';
import { STICK_IDLE, stickCommand } from '@e07/game-kit/geom/stick-command.ts';

import { IDLE_POINTER } from './board-types.ts';
import { HIT_SLOP, liftedPoint, panIntent } from './pan-intent.ts';

import type { PointerSample } from './board-types.ts';
import type { PanMode } from './pan-intent.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type {
  ExclusiveGesture,
  LongPressGesture,
  PanGesture,
  TapGesture,
} from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

const TAP_MAX_MS = 250;
const LONG_PRESS_MS = 450;
const PAN_MIN_DISTANCE = 10;

export type BoardGestureHandlers = {
  readonly panMode: PanMode;
  /**
   * Points a drag's pointer sits above the finger (GameBoard.dragLiftPt; 0 = none). The hover, the
   * drawn ghost and the drop target all use the lifted point, so the ghost is where the block lands.
   */
  readonly dragLiftPt?: number;
  readonly onIntent: (intent: InputIntent) => void;
  /** Hovered cell changed during a drag (JS computes a legality preview). */
  readonly onHover: (target: BoardTarget | null) => void;
  /**
   * A tap that hit no region (outside the board and the tray, beyond the hit slop): the host
   * drops its tap-then-tap selection. Never an intent: nothing is sent to the run.
   */
  readonly onMiss?: () => void;
};

export type BoardGestures = {
  readonly gesture: ExclusiveGesture;
  readonly pointer: SharedValue<PointerSample>;
};

type Wiring = {
  readonly layout: SharedValue<BoardLayout>;
  readonly pointer: SharedValue<PointerSample>;
  readonly handlers: BoardGestureHandlers;
};

function makeTap({ layout, handlers }: Wiring): TapGesture {
  const { onIntent, onMiss } = handlers;
  return Gesture.Tap()
    .withTestId('board.tap')
    .maxDuration(TAP_MAX_MS)
    .onEnd((event, isSuccess) => {
      if (!isSuccess) return;
      const target = hitTest(layout.get(), event, HIT_SLOP);
      // The host fills in `selected` (its UI-only selection); the gesture layer never knows it.
      if (target !== null) scheduleOnRN(onIntent, { kind: 'tap', target, selected: null });
      else if (onMiss !== undefined) scheduleOnRN(onMiss);
    });
}

function makeLongPress({ layout, handlers }: Wiring): LongPressGesture {
  const { onIntent } = handlers;
  return Gesture.LongPress()
    .withTestId('board.long-press')
    .minDuration(LONG_PRESS_MS)
    .onStart((event) => {
      const target = hitTest(layout.get(), event, HIT_SLOP);
      if (target !== null) scheduleOnRN(onIntent, { kind: 'long-press', target });
    });
}

function makePan({ layout, pointer, handlers }: Wiring): PanGesture {
  const { onIntent, onHover, panMode } = handlers;
  const dragLiftPt = handlers.dragLiftPt ?? 0;
  return Gesture.Pan()
    .withTestId('board.pan')
    .enabled(panMode !== 'none')
    .minDistance(PAN_MIN_DISTANCE)
    .onStart((event) => {
      // The press itself is never lifted: the drag starts where the finger went down.
      const origin = { x: event.x - event.translationX, y: event.y - event.translationY };
      const dragFrom = hitTest(layout.get(), origin, HIT_SLOP);
      const aim = liftedPoint(event, dragLiftPt);
      const hover = hitTest(layout.get(), aim, HIT_SLOP);
      pointer.set({ isDown: true, x: aim.x, y: aim.y, hover, dragFrom });
    })
    .onUpdate((event) => {
      const previous = pointer.get();
      const aim = liftedPoint(event, dragLiftPt);
      const hover = hitTest(layout.get(), aim, HIT_SLOP);
      pointer.set({ ...previous, x: aim.x, y: aim.y, hover });
      if (!isSameTarget(hover, previous.hover)) scheduleOnRN(onHover, hover);
    })
    .onEnd((event, isSuccess) => {
      const release = { mode: panMode, pointer: pointer.get(), release: event, dragLiftPt };
      const intent = isSuccess ? panIntent({ ...release, layout: layout.get() }) : null;
      if (intent !== null) scheduleOnRN(onIntent, intent);
    })
    .onFinalize(() => {
      pointer.value = IDLE_POINTER;
    });
}

/** One Exclusive composition per board: pan beats long-press beats tap. */
export function useBoardGestures(
  layout: SharedValue<BoardLayout>,
  handlers: BoardGestureHandlers,
): BoardGestures {
  const pointer = useSharedValue<PointerSample>(IDLE_POINTER);
  const wiring = { layout, pointer, handlers };
  const gesture = Gesture.Exclusive(makePan(wiring), makeLongPress(wiring), makeTap(wiring));
  return { gesture, pointer };
}

/**
 * Real-time boards (one-thumb stick): a pan anywhere writes an integer command (0 idle, 1…16)
 * into the loop's command shared value, only when it changes; lifting the finger writes 0.
 * Plain builder (no hooks inside), so the host may call it during render.
 */
export function makeStickGesture(command: SharedValue<number>): PanGesture {
  return Gesture.Pan()
    .withTestId('board.stick')
    .minDistance(0)
    .onUpdate((event) => {
      const next = stickCommand(event.translationX, event.translationY);
      if (next !== command.get()) command.set(next);
    })
    .onFinalize(() => {
      command.set(STICK_IDLE);
    });
}
