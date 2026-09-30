// packages/shell/src/stores/settings-store.ts
import { create } from 'zustand';

/** Created by createShellApp, never at import time. */
export function createSettingsStore(): unknown {
  return create(() => ({ theme: 1 }));
}
