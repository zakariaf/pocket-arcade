// packages/shell/src/screens/settings/use-settings-context.ts
// Gathers the facts outside the settings store that decide which S11 rows exist.
import { useOptionalConsentMoment } from '@e07/shell/app/consent-moment-context.tsx';
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';

import type { SettingsContext } from './settings-rows.ts';

/**
 * `hasMusic` is the game host's (true when the game's sound bank has a 'music' sound; most games
 * have none), so no extra provider is needed. The Ad privacy row follows the consent moment's live
 * answer (a refresh or a form while S11 is open shows or hides it at once); outside the moment
 * (screen and hook tests) it reads the save's last consent answer.
 */
export function useSettingsContext(): SettingsContext {
  const { haptics, save } = useServices();
  const { hasMusic } = useGameHost();
  const isPremium = usePremiumStore((state) => state.isPremium);
  const isLiveRequired = useOptionalConsentMoment()?.isPrivacyOptionsRequired;
  return {
    hasMusic,
    canVibrate: haptics.isSupported,
    isPrivacyOptionsRequired: isLiveRequired ?? save.doc().ads.consent.isPrivacyOptionsRequired,
    isPremium,
  };
}
