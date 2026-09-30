// packages/shell/src/game-host/use-board-gestures.ts (Gesture Handler 2 builder API)
import { Gesture } from 'react-native-gesture-handler';

export function makeBoardGestures(onTap: (x: number, y: number) => void) {
  const tap = Gesture.Tap().onEnd((event, success) => {
    if (success) {
      onTap(event.x, event.y);
    }
  });
  const pan = Gesture.Pan();
  return Gesture.Exclusive(pan, tap);
}
