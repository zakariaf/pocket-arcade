// An imported constant: Metro keeps the module in store bundles.
import { IS_TEST_BUILD } from '@e07/shell/config/build-flags.ts';
import type { TestOnlyApi } from './test-only-api.ts';

export const TEST_ONLY: TestOnlyApi | null = IS_TEST_BUILD
  ? (require('./test-only-entry.ts') as TestOnlyApi)
  : null;
