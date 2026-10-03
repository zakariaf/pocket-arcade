// packages/shell/src/app/stores-context.tsx
import { createContext, use } from 'react';

import type { PremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import type { ProgressStore } from '@e07/shell/stores/progress-store.ts';
import type { SettingsStore } from '@e07/shell/stores/settings-store.ts';
import type { StatsStore } from '@e07/shell/stores/stats-store.ts';
import type { JSX, ReactNode } from 'react';

/**
 * The app-state stores, created once per app start (and per test) from the loaded
 * save document by createShellStores(save). Injected like services; never module-level singletons.
 */
export type ShellStores = {
  readonly settings: SettingsStore;
  readonly progress: ProgressStore;
  readonly stats: StatsStore;
  readonly premium: PremiumStore;
};

const StoresContext = createContext<ShellStores | null>(null);

export type StoresProviderProps = {
  readonly stores: ShellStores;
  readonly children: ReactNode;
};

export function StoresProvider({ stores, children }: StoresProviderProps): JSX.Element {
  return <StoresContext value={stores}>{children}</StoresContext>;
}

/** Returns the stores. A missing provider is a programmer error, so it throws. */
export function useStores(): ShellStores {
  const stores = use(StoresContext);
  if (stores === null) throw new Error('useStores() needs a <StoresProvider> above it');
  return stores;
}
