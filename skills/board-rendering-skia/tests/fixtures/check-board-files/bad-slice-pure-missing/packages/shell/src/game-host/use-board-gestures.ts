// packages/shell/src/game-host/use-board-gestures.ts
// Fixture stand-in for the gesture kit (board-gestures-and-input ships the real one).
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { IDLE_POINTER } from './board-types.ts';

import type { PointerSample } from './board-types.ts';
import type { PanMode } from './pan-intent.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { SharedValue } from 'react-native-reanimated';

export type BoardGestureHandlers = {
  readonly panMode: PanMode;
  readonly dragLiftPt?: number;
  readonly onIntent: (intent: InputIntent) => void;
  readonly onHover: (target: BoardTarget | null) => void;
};

export function useBoardGestures(_layout: SharedValue<BoardLayout>, _handlers: BoardGestureHandlers) {
  const pointer = useSharedValue<PointerSample>(IDLE_POINTER);
  return { gesture: Gesture.Exclusive(Gesture.Tap().withTestId('board.tap')), pointer };
}
