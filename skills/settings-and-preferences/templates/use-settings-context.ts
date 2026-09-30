// packages/shell/src/screens/settings/use-settings-context.ts
// Gathers the facts outside the settings store that decide which S11 rows exist.
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';

import type { SettingsContext } from './settings-rows.ts';

/**
 * `hasMusic` is the game host's (true when the game's sound bank has a 'music' sound; most games
 * have none), so no extra provider is needed. Consent is read from the save's last consent answer,
 * which the ads service updates after every consent refresh.
 */
export function useSettingsContext(): SettingsContext {
  const { haptics, save } = useServices();
  const { hasMusic } = useGameHost();
  const isPremium = usePremiumStore((state) => state.isPremium);
  return {
    hasMusic,
    canVibrate: haptics.isSupported,
    isPrivacyOptionsRequired: save.doc().ads.consent.isPrivacyOptionsRequired,
    isPremium,
  };
}
