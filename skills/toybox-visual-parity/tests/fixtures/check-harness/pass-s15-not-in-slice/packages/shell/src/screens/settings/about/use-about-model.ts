// packages/shell/src/screens/settings/about/use-about-model.ts (fixture: S11b shows the design's support address in a capture)
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

export function emailTextOf(supportEmail: string): string {
  return TEST_ONLY?.paritySupportEmail() ?? supportEmail;
}
