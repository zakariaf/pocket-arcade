// packages/shell/src/app/test-only.ts
import { IS_TEST_BUILD } from './build-flags.ts';
import type { TestOnlyApi } from './test-only-api.ts';

export const TEST_ONLY: TestOnlyApi | null = IS_TEST_BUILD
  ? (require('./test-only-entry.ts') as TestOnlyApi)
  : null;
