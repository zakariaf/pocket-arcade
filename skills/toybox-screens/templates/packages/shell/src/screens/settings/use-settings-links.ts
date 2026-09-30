// packages/shell/src/screens/settings/use-settings-links.ts
// S11's hand-offs to other apps (never a network request of our own): Rate opens the App Store's
// review page (only once the game has an App Store id), Contact opens the mail app with the support
// address and the version filled in. The URLs are built only in config/external-links.ts, the one
// file the no-URL lint rule and the network audit exempt. A failed hand-off is logged, never shown.
import { Linking } from 'react-native';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { storeReviewUrl, supportMailUrl } from '@e07/shell/config/external-links.ts';

import type { SettingsExtras } from './settings-extras.ts';

export type SettingsLinks = Pick<SettingsExtras, 'onRate' | 'onContact'>;

export function useSettingsLinks(versionText: string): SettingsLinks {
  const { errorLog } = useServices();
  const extra = useGameExtra();
  const open = (url: string | null): void => {
    if (url === null) return;
    Linking.openURL(url).catch((error: unknown) => {
      errorLog.record('boot', error);
    });
  };
  return {
    onRate: () => {
      open(storeReviewUrl(extra.appStoreId));
    },
    onContact: () => {
      open(supportMailUrl(extra.links.supportEmail, versionText));
    },
  };
}
