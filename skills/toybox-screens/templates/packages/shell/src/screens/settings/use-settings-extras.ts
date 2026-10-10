// packages/shell/src/screens/settings/use-settings-extras.ts
// S11's SettingsExtras: the store price (premium store), the version line ("1.0.0 (8)":
// readVersionText, expo-constants' version and ios.buildNumber), the screens the rows open
// (use-settings-routes.ts), the hand-offs (use-settings-links.ts), Restore purchase, the consent
// form (through the consent moment, which saves the answer and turns the banners on or off at
// once), and the two S14 reset dialogs. Every handler stays synchronous (promises end in .catch).
// A parity capture of s14-reset-all-progress (test builds) opens Reset all progress over S11 the
// way the row does, with the hold frozen at 46 % as the design draws it.
import { useOptionalAdPrivacyChoices } from '@e07/shell/app/consent-moment-context.tsx';
import { useOpenDialog } from '@e07/shell/app/dialog-context.tsx';
import { usePremiumScreenDeps } from '@e07/shell/app/premium-screen-deps-context.tsx';
import { readVersionText } from '@e07/shell/app/read-version-text.ts';
import { useParityOpener } from '@e07/shell/app/use-parity-opener.ts';
import { restorePremium } from '@e07/shell/services/purchase/premium-service.ts';
import { priceOf } from '@e07/shell/stores/premium/premium-state.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { useSettingsResets } from '@e07/shell/stores/use-settings-resets.ts';

import { useSettingsLinks } from './use-settings-links.ts';
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

/**
 * Ad privacy choices, only through the consent moment (ShellFeatures), which saves the answer and
 * turns the banners on or off at once; hook tests get create-host-wrapper's stand-in. Without it
 * the screen fails loudly: a bare consent port would drop the answer.
 */
function useAdPrivacyChoices(): () => void {
  const reopen = useOptionalAdPrivacyChoices();
  if (reopen === null) {
    throw new Error(
      'S11 Ad privacy choices needs the consent moment: render it inside <ConsentMoment> or a wrapper that provides AdPrivacyChoicesContext',
    );
  }
  return reopen;
}

export function useSettingsExtras(): SettingsExtras {
  const openDialog = useOpenDialog();
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
    onOpenAdPrivacy: useAdPrivacyChoices(),
    onResetStats: () => {
      openDialog({ kind: 'reset-stats', onConfirm: resets.onConfirmResetStats });
    },
    onResetProgress,
  };
}
