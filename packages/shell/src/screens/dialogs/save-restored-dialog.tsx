// packages/shell/src/screens/dialogs/save-restored-dialog.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { Button } from '@e07/shell/ui/button.tsx';
import { DialogButtonRow } from '@e07/shell/ui/dialog-button-row.tsx';

import { DialogFrame } from './dialog-frame.tsx';

import type { ReactNode } from 'react';

export type SaveRestoredDialogProps = {
  readonly onOk: () => void;
  readonly isReducedMotion: boolean;
};

/** S14 "Progress restored" over Home: a damaged save fell back to the backup copy. Never a crash. */
export function SaveRestoredDialog({ onOk, isReducedMotion }: SaveRestoredDialogProps): ReactNode {
  const t = useT();
  return (
    <DialogFrame
      scope="save-restored-dialog"
      art={{ icon: 'restore', paint: 'gold' }}
      title={t('dialog.save-restored.title')}
      body={t('dialog.save-restored.body')}
    >
      <DialogButtonRow testID="save-restored-dialog.buttons">
        <Button
          testID="save-restored-dialog.ok-button"
          label={t('common.ok')}
          onPress={onOk}
          kind="primary"
          isInRow
          isReducedMotion={isReducedMotion}
        />
      </DialogButtonRow>
    </DialogFrame>
  );
}
