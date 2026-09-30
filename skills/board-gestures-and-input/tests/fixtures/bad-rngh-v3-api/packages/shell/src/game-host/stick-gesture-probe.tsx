// packages/shell/src/game-host/stick-gesture-probe.tsx
// Test-only host: a plain View wired to makeStickGesture (Skia and the loop are not needed).
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { makeStickGesture } from './use-board-gestures.ts';

import type { SharedValue } from 'react-native-reanimated';

export type StickGestureProbeProps = { readonly command: SharedValue<number> };

export function StickGestureProbe(props: StickGestureProbeProps): React.JSX.Element {
  return (
    <GestureDetector gesture={makeStickGesture(props.command)}>
      <View testID="board.stick-surface" />
    </GestureDetector>
  );
}
