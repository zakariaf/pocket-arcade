// packages/shell/src/game-host/board-gesture-probe.tsx
// Test-only host: a plain View wired to useBoardGestures (Skia is not needed to test input).
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { useBoardGestures } from './use-board-gestures.ts';

import type { PanMode } from './pan-intent.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

export type BoardGestureProbeProps = {
  readonly layout: BoardLayout;
  readonly panMode: PanMode;
  readonly dragLiftPt?: number;
  readonly onIntent: (intent: InputIntent) => void;
  readonly onHover?: (target: BoardTarget | null) => void;
  readonly onMiss?: () => void;
};

const ignoreHover = (): void => undefined;

export function BoardGestureProbe(props: BoardGestureProbeProps): React.JSX.Element {
  const layout = useSharedValue(props.layout);
  const { gesture } = useBoardGestures(layout, {
    panMode: props.panMode,
    dragLiftPt: props.dragLiftPt ?? 0,
    onIntent: props.onIntent,
    onHover: props.onHover ?? ignoreHover,
    ...(props.onMiss === undefined ? {} : { onMiss: props.onMiss }),
  });
  return (
    <GestureDetector gesture={gesture}>
      <View testID="board.surface" />
    </GestureDetector>
  );
}
