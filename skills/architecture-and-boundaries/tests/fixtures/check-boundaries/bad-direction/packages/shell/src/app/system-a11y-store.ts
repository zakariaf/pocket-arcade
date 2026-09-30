// packages/shell/src/app/system-a11y-store.ts
import { createStore } from 'zustand/vanilla';

/** Mirror of the OS accessibility switches (in memory, not persisted). */
export const systemA11yStore = createStore(() => ({ isReduceMotionOn: false }));
