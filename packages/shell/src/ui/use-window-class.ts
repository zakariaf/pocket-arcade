// packages/shell/src/ui/use-window-class.ts
import { useWindowDimensions } from 'react-native';

import { classifyWindow } from './window-class.ts';

import type { WindowClass } from './window-class.ts';

/** Re-renders on rotation, iPad split view / Stage Manager and iOS 27 resizable windows. */
export function useWindowClass(): WindowClass {
  const { width, height, fontScale } = useWindowDimensions();
  return classifyWindow(width, height, fontScale);
}
