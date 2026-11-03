// packages/shell/src/screens/settings/privacy/use-privacy-policy-model.ts (fixture: S11c names the design's support address in a capture)
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

export function emailTextOf(supportEmail: string): string {
  return TEST_ONLY?.paritySupportEmail() ?? supportEmail;
}
