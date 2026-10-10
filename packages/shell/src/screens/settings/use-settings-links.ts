// packages/shell/src/screens/settings/use-settings-links.ts
// S11's hand-offs to other apps (never a network request of our own): Rate opens the App Store's
// review page (only once the game has an App Store id), Contact opens the mail app with the support
// address and the version filled in. The URLs are built only in config/external-links.ts, the one
// file the no-URL lint rule and the network audit exempt; useOpenExternal hands them over and logs a
// failed hand-off, never shows it.
import { useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { useOpenExternal } from '@e07/shell/app/use-open-external.ts';
import { storeReviewUrl, supportMailUrl } from '@e07/shell/config/external-links.ts';

import type { SettingsExtras } from './settings-extras.ts';

export type SettingsLinks = Pick<SettingsExtras, 'onRate' | 'onContact'>;

export function useSettingsLinks(versionText: string): SettingsLinks {
  const extra = useGameExtra();
  const open = useOpenExternal();
  return {
    onRate: () => {
      open(storeReviewUrl(extra.appStoreId));
    },
    onContact: () => {
      open(supportMailUrl(extra.links.supportEmail, versionText));
    },
  };
}
