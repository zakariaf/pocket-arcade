// packages/shell/src/app/test-only-entry.ts (fixture): test builds only.
import { createAdmobConsentDebugAdapter } from '@e07/shell/services/consent/admob-consent-debug-adapter.ts';

export const TEST_BUILD_SENTINEL = 'SHELL_TEST_BUILD_ONLY';
export const consentDebugTools = createAdmobConsentDebugAdapter();
