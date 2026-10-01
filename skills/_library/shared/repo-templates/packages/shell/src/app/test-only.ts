// packages/shell/src/app/test-only.ts
// device-only: covered by check-sim-setup's sentinel checks and the store-artifact gate
// The ONLY file allowed to require() test-only code (ESLint file-level exemption).
// The gate must be this literal comparison: an imported constant does not strip code.
import type { TestOnlyApi } from './test-only-api.ts';

export const TEST_ONLY: TestOnlyApi | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'store'
    ? null
    : (require('./test-only-entry.ts') as TestOnlyApi);
