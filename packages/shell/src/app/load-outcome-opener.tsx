// packages/shell/src/app/load-outcome-opener.tsx
// The S14 dialog the save's load outcome asks for, opened once over the first screen (spec 8.6 and
// 8.14): "Progress restored" when the save fell back to its backup copy, "please update" when the
// save comes from a newer app version (the app then plays read-only, so this shows at every launch);
// its Update opens the store's page of the game: the App Store on iOS, Google Play on Android.
// ShellNavigator mounts it inside the dialog host while there is an outcome; ShellApp passes
// hydrated.outcome, or null after the crash screen's "Back to Home" so a remounted tree never asks
// twice.
import { useEffect, useEffectEvent } from 'react';

import { useOpenDialog } from '@e07/shell/app/dialog-context.tsx';
import { readGameExtra } from '@e07/shell/app/read-game-extra.ts';
import { readStoreIds } from '@e07/shell/app/read-store-ids.ts';
import { useOpenExternal } from '@e07/shell/app/use-open-external.ts';
import { storeUpdateUrlsOf } from '@e07/shell/config/external-links.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';

import type { DialogRequest } from '@e07/shell/screens/dialogs/dialog-request.ts';
import type { LoadOutcome } from '@e07/shell/services/save/load-plan.ts';
import type { ReactNode } from 'react';

/** The newer-save dialog's two inputs: the game's name and what "Update" does. */
export type NewerSaveInput = { readonly gameName: string; readonly onUpdate: () => void };

/**
 * Pure: the dialog a load outcome opens. A fresh, loaded or migrated save opens none; a reset after
 * damage has no backup to announce, so it opens none either (the error log keeps the reason). The
 * newer-save inputs are read only for that dialog.
 */
export function loadOutcomeRequest(
  outcome: LoadOutcome,
  newerSave: () => NewerSaveInput,
): DialogRequest | null {
  if (outcome.kind === 'restored-from-backup') return { kind: 'save-restored' };
  if (outcome.kind === 'newer-version') return { kind: 'newer-save', ...newerSave() };
  return null;
}

export type LoadOutcomeOpenerProps = {
  /** hydrated.outcome at launch. */
  readonly outcome: LoadOutcome;
};

/** Opens the outcome's dialog once, when the navigator's first screen mounts; draws nothing. */
export function LoadOutcomeOpener({ outcome }: LoadOutcomeOpenerProps): ReactNode {
  const openDialog = useOpenDialog();
  const open = useOpenExternal();
  const t = useT();
  const { nameId } = useGameHost();
  const handleUpdate = (): void => {
    open(storeUpdateUrlsOf(readStoreIds(readGameExtra().appStoreId)));
  };
  const openOnce = useEffectEvent(() => {
    const request = loadOutcomeRequest(outcome, () => ({
      gameName: gameMessageText(t, { id: nameId }),
      onUpdate: handleUpdate,
    }));
    if (request !== null) openDialog(request);
  });
  useEffect(() => {
    openOnce();
  }, []);
  return null;
}
