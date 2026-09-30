// packages/shell/src/app/use-reduce-motion.ts
// The one reduce-motion answer every animation reads (MotionConfig, stickers, stars, confetti,
// the level flag, the busy blocks, screen transitions). A parity capture (test builds, a launch
// with animations=off) holds all of them still at rest through TEST_ONLY; the saved setting and
// the Settings "Reduce motion" row are untouched, because they read useReduceMotionSetting().
// Code the test-only entry reaches (the S15 debug model) reads useReduceMotionSetting() instead:
// importing this file there closes an import loop through test-only.ts.
import { TEST_ONLY } from './test-only.ts';
import { useReduceMotionSetting } from './use-reduce-motion-setting.ts';

/**
 * The TEST_ONLY members this hook reads. isParityMotionFrozen joins the test-only pair with the
 * parity harness, after this file exists (Shell steps 6-7 hold only the sentinel), so it is
 * optional here: the hook compiles before and after the member joins.
 */
type ParityMotionApi = {
  readonly TEST_BUILD_SENTINEL: string;
  readonly isParityMotionFrozen?: () => boolean;
};

/** Read at call time: TEST_ONLY is still being built while the test-only entry loads. */
function isParityMotionFrozen(): boolean {
  const api: ParityMotionApi | null = TEST_ONLY;
  return api?.isParityMotionFrozen?.() === true;
}

/** Every animation's answer: the saved setting, and always true while a parity capture runs. */
export function useReduceMotion(): boolean {
  const isSetOn = useReduceMotionSetting();
  // Store builds have no TEST_ONLY; test builds before the parity harness lack the member.
  return isParityMotionFrozen() || isSetOn;
}
