// packages/shell/src/screens/home/use-home-swipe.ts
import { Gesture } from 'react-native-gesture-handler';

import type { PanGesture } from 'react-native-gesture-handler';

export function useHomeSwipe(): PanGesture {
  return Gesture.Pan().withTestId('home.swipe');
}
