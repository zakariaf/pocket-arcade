// packages/shell/src/app/test-only-entry.ts (fixture): test builds only.
import { installNetworkGuard } from '@e07/shell/screens/debug/network-guard.ts';

export const TEST_BUILD_SENTINEL = 'SHELL_TEST_BUILD_ONLY';
export const networkGuard = installNetworkGuard(globalThis, () => undefined);
