// packages/shell/src/app/use-reduce-motion.ts (fixture: the one frozen-motion switch)
import { TEST_ONLY } from './test-only.ts';

export function useReduceMotion(isSaved: boolean): boolean {
  return isSaved || TEST_ONLY?.isParityMotionFrozen() === true;
}
