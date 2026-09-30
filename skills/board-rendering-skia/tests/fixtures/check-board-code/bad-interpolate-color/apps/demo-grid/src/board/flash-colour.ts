// apps/demo-grid/src/board/flash-colour.ts
import { interpolateColor } from 'react-native-reanimated';

export function flashColour(progress: number): string {
  return interpolateColor(progress, [0, 1], ['#ffffff', '#ff0000']);
}
