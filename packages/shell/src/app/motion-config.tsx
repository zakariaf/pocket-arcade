// packages/shell/src/app/motion-config.tsx
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

import { useReduceMotion } from './use-reduce-motion.ts';

import type { ReactNode } from 'react';

/** Makes every Reanimated animation follow the Shell setting, not only the OS switch. */
export function MotionConfig(): ReactNode {
  const isReduced = useReduceMotion();
  return <ReducedMotionConfig mode={isReduced ? ReduceMotion.Always : ReduceMotion.Never} />;
}
