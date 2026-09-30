// apps/demo-grid/src/board/word-label.ts
import { TextDirection } from '@shopify/react-native-skia';

export function paragraphDirection(isRtl: boolean): TextDirection | false {
  return isRtl && TextDirection.RTL;
}
