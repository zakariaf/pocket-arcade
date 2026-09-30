// packages/shell/src/screens/dialogs/restart-dialog.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { Button } from '@e07/shell/ui/button.tsx';
import { DialogButtonRow } from '@e07/shell/ui/dialog-button-row.tsx';

import { DialogFrame } from './dialog-frame.tsx';

import type { ReactNode } from 'react';

export type RestartDialogProps = {
  /** restartForDirection(): the save is untouched either way. */
  readonly onRestart: () => void;
  readonly onLater: () => void;
  readonly isReducedMotion: boolean;
};

/** S14 "Restart to apply" over S11a, after a language change that flips the direction. */
export function RestartDialog({
  onRestart,
  onLater,
  isReducedMotion,
}: RestartDialogProps): ReactNode {
  const t = useT();
  return (
    <DialogFrame
      scope="restart-dialog"
      art={{ icon: 'globe', paint: 'pop' }}
      title={t('settings.language.restart.title')}
      body={t('settings.language.restart.body')}
    >
      <DialogButtonRow testID="restart-dialog.buttons">
        <Button
          testID="restart-dialog.later-button"
          label={t('settings.language.restart.later')}
          onPress={onLater}
          isInRow
          isReducedMotion={isReducedMotion}
        />
        <Button
          testID="restart-dialog.restart-button"
          label={t('settings.language.restart.confirm')}
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
