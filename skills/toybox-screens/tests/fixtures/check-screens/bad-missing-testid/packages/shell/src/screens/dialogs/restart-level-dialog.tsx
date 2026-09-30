// packages/shell/src/screens/dialogs/restart-level-dialog.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { Button } from '@e07/shell/ui/button.tsx';
import { DialogButtonRow } from '@e07/shell/ui/dialog-button-row.tsx';

import { DialogFrame } from './dialog-frame.tsx';

import type { ReactNode } from 'react';

export type RestartLevelDialogProps = {
  readonly onRestart: () => void;
  readonly onCancel: () => void;
  readonly isReducedMotion: boolean;
};

/**
 * S14 "Restart this level?" from Pause (Chosen; not drawn): only when progress beyond a few
 * moves would be lost. No art; Cancel at the start, Restart (primary) at the end.
 */
export function RestartLevelDialog({
  onRestart,
  onCancel,
  isReducedMotion,
}: RestartLevelDialogProps): ReactNode {
  const t = useT();
  return (
    <DialogFrame
      scope="restart-level-dialog"
      title={t('dialog.restart-level.title')}
      body={t('dialog.restart-level.body')}
    >
      <DialogButtonRow testID="restart-level-dialog.buttons">
        <Button
          testID="restart-level-dialog.cancel-button"
          label={t('common.cancel')}
          onPress={onCancel}
          isInRow
          isReducedMotion={isReducedMotion}
        />
        <Button
          testID="restart-level-dialog.restart-button"
          label={t('dialog.restart-level.confirm')}
          onPress={onRestart}
          kind="primary"
          icon="restore"
          isInRow
          isReducedMotion={isReducedMotion}
        />
      </DialogButtonRow>
    </DialogFrame>
  );
}
