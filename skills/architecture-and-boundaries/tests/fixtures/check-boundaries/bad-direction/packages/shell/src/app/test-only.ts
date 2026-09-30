// packages/shell/src/app/test-only.ts
import type { TestOnlyApi } from './test-only-api.ts';

export const TEST_ONLY: TestOnlyApi | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'store'
    ? null
    : (require('./test-only-entry.ts') as TestOnlyApi);
