// packages/shell/src/screens/dialogs/reset-stats-dialog.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { Button } from '@e07/shell/ui/button.tsx';

import { DialogFrame } from './dialog-frame.tsx';

import type { ReactNode } from 'react';

export type ResetStatsDialogProps = {
  /** Clears only the statistics section; levels, stars and Premium stay. */
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly isReducedMotion: boolean;
};

/** S14 "Reset statistics?" from S10 or S11 (Chosen; not drawn): the reset layout without the hold. */
export function ResetStatsDialog({
  onConfirm,
  onCancel,
  isReducedMotion,
}: ResetStatsDialogProps): ReactNode {
  const t = useT();
  return (
    <DialogFrame
      scope="reset-stats-dialog"
      art={{ icon: 'trash', paint: 'danger', size: 'dialog' }}
      title={t('dialog.reset-stats.title')}
      body={t('dialog.reset-stats.body')}
    >
      <Button
        testID="reset-stats-dialog.confirm-button"
        label={t('dialog.reset-stats.confirm')}
        onPress={onConfirm}
        kind="danger"
        icon="trash"
        isBlock
        isReducedMotion={isReducedMotion}
      />
      <Button
        testID="reset-stats-dialog.cancel-button"
        label={t('common.cancel')}
        onPress={onCancel}
        isBlock
        isReducedMotion={isReducedMotion}
      />
    </DialogFrame>
  );
}
