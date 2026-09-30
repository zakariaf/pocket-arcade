// packages/shell/src/screens/debug/use-font-test-model.ts
// The font test page's model (S15, test builds): every Toybox type role and component text style
// with a sample in each language. The page has no controls; the stack's edge swipe goes back.
import { FONT_TEST_SAMPLES, FONT_TEST_VARIANTS, fontTestRowsOf } from './font-test-samples.ts';

import type { FontTestModel } from './font-test-view.tsx';

export function useFontTestModel(): FontTestModel {
  return { rows: fontTestRowsOf(FONT_TEST_VARIANTS, FONT_TEST_SAMPLES) };
}
