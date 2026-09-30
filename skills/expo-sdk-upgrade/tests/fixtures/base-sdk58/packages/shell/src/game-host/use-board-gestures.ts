// packages/shell/src/game-host/use-board-gestures.ts (Gesture Handler 3 hook API)
import { useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';

export function useBoardGestures(onTap: (x: number, y: number) => void) {
  const tap = useTapGesture({
    onDeactivate: (event) => {
      if (event.canceled) {
        return;
      }
      onTap(event.x, event.y);
    },
  });
  const pan = usePanGesture({ onUpdate: () => undefined });
  return useExclusiveGestures(pan, tap);
}
