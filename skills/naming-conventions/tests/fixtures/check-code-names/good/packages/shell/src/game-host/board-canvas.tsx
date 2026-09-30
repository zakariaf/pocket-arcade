// packages/shell/src/game-host/board-canvas.tsx
import { Canvas } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

/** Skia's onSize takes a shared value, not a function, so it is not a handler. */
export function BoardCanvas(): React.JSX.Element {
  const size = useSharedValue({ width: 0, height: 0 });
  return <Canvas onSize={size} />;
}
