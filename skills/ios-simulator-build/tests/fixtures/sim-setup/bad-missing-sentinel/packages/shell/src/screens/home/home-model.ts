// Test-only features are read through the gate, never imported directly.
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

export const hasDebugMenu = (): boolean => TEST_ONLY !== null;
