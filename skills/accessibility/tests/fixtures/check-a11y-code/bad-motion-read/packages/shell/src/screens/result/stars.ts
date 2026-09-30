import { AccessibilityInfo } from 'react-native';

export async function shouldAnimate(): Promise<boolean> {
  return !(await AccessibilityInfo.isReduceMotionEnabled());
}
