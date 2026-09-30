// packages/shell/src/app/test-only-api.ts (fixture: a type-only import of the guard ships no code)
import type { NetworkAttempt, NetworkGuard } from '@e07/shell/screens/debug/network-guard.ts';

export type TestOnlyApi = {
  readonly installNetworkGuard: (
    scope: object,
    onAttempt: (attempt: NetworkAttempt) => void,
  ) => NetworkGuard;
};
