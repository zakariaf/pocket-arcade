// packages/shell/src/screens/settings/use-settings-extras.ts
// S11's SettingsExtras: the store price (premium store), the version line ("1.0.0 (8)":
// readVersionText, expo-constants' version and ios.buildNumber), the screens the rows open
// (use-settings-routes.ts), the hand-offs (use-settings-links.ts), Restore purchase, the consent
// form, and the two S14 reset dialogs. Every handler stays synchronous (promises end in .catch).
// A parity capture of s14-reset-all-progress (test builds) opens Reset all progress over S11 the
// way the row does, with the hold frozen at 46 % as the design draws it.
import { useOpenDialog } from '@e07/shell/app/dialog-context.tsx';
import { usePremiumScreenDeps } from '@e07/shell/app/premium-screen-deps-context.tsx';
import { readVersionText } from '@e07/shell/app/read-version-text.ts';
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useParityOpener } from '@e07/shell/app/use-parity-opener.ts';
import { restorePremium } from '@e07/shell/services/purchase/premium-service.ts';
import { priceOf } from '@e07/shell/stores/premium/premium-state.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';

import { useSettingsLinks } from './use-settings-links.ts';
import { useSettingsResets } from './use-settings-resets.ts';
import { useSettingsRoutes } from './use-settings-routes.ts';

import type { SettingsExtras } from './settings-extras.ts';

/** The design's s14-reset-all-progress frame: the hold key 46 % full. */
const PARITY_HELD_PROGRESS = 0.46;

/** "Reset all progress": the row opens it; its parity frame opens it held. */
function useResetProgressDialog(): () => void {
  const openDialog = useOpenDialog();
  const { onConfirmResetProgress: onConfirm } = useSettingsResets();
  useParityOpener('reset-progress-dialog-held', () => {
    openDialog({ kind: 'reset-progress', onConfirm, frozenProgress: PARITY_HELD_PROGRESS });
  });
  return () => {
    openDialog({ kind: 'reset-progress', onConfirm });
  };
}

export function useSettingsExtras(): SettingsExtras {
  const openDialog = useOpenDialog();
  const { consent, errorLog } = useServices();
  const { service } = usePremiumScreenDeps();
  const resets = useSettingsResets();
  const onResetProgress = useResetProgressDialog();
  const versionText = readVersionText();
  return {
    removeAdsPriceText: usePremiumStore((state) => priceOf(state.flow)),
    versionText,
    ...useSettingsRoutes(),
    ...useSettingsLinks(versionText),
    onRestorePurchase: () => {
      restorePremium(service).catch(service.onError);
    },
    onOpenAdPrivacy: () => {
      consent.showPrivacyOptions().catch((error: unknown) => {
        errorLog.record('ads', error);
      });
    },
    onResetStats: () => {
      openDialog({ kind: 'reset-stats', onConfirm: resets.onConfirmResetStats });
    },
    onResetProgress,
  };
}
