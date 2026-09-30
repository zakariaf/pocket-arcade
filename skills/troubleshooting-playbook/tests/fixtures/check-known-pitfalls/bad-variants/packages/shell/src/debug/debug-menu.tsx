// packages/shell/src/debug/debug-menu.tsx
import { IS_TEST_BUILD } from '../app/flags.ts';
export const debug = IS_TEST_BUILD ? require('../app/test-only-entry.ts') : null;
