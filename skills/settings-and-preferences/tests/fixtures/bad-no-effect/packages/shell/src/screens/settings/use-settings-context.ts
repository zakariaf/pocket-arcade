// packages/shell/src/screens/settings/use-settings-context.ts
// Gathers the facts outside the settings store that decide which S11 rows exist.
import { useServices } from '@e07/shell/app/services-context.tsx';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';

import type { SettingsContext } from './settings-rows.ts';

/**
 * `hasMusic` comes from the game module (its sound bank has a 'music' sound); the Settings
 * screen passes it in. Consent is read from the save's last consent answer, which the ads
 * service updates after every consent refresh.
 */
export function useSettingsContext(hasMusic: boolean): SettingsContext {
  const { haptics, save } = useServices();
  const isPremium = usePremiumStore((state) => state.isPremium);
  return {
    hasMusic,
    canVibrate: haptics.isSupported,
    isPrivacyOptionsRequired: save.doc().ads.consent.isPrivacyOptionsRequired,
    isPremium,
  };
}
