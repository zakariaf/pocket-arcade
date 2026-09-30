// packages/shell/src/screens/dialogs/newer-save-dialog.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { Button } from '@e07/shell/ui/button.tsx';
import { DialogButtonRow } from '@e07/shell/ui/dialog-button-row.tsx';

import { DialogFrame } from './dialog-frame.tsx';

import type { ReactNode } from 'react';

export type NewerSaveDialogProps = {
  readonly gameName: string;
  /** Opens the store page; the newer save stays untouched. */
  readonly onUpdate: () => void;
  readonly onLater: () => void;
  readonly isReducedMotion: boolean;
};

/** S14 "Please update the game" (Chosen; not drawn): a save from a newer app version was found. */
export function NewerSaveDialog({
  gameName,
  onUpdate,
  onLater,
  isReducedMotion,
}: NewerSaveDialogProps): ReactNode {
  const t = useT();
  return (
    <DialogFrame
      scope="newer-save-dialog"
      art={{ icon: 'restore', paint: 'gold' }}
      title={t('dialog.newer-save.title')}
      body={t('dialog.newer-save.body', { gameName })}
    >
      <DialogButtonRow testID="newer-save-dialog.buttons">
        <Button
          testID="newer-save-dialog.later-button"
          label={t('dialog.newer-save.later-button')}
          onPress={onLater}
          isInRow
          isReducedMotion={isReducedMotion}
        />
        <Button
          testID="newer-save-dialog.update-button"
          label={t('dialog.newer-save.update-button')}
          onPress={onUpdate}
          kind="primary"
          isInRow
          isReducedMotion={isReducedMotion}
        />
      </DialogButtonRow>
    </DialogFrame>
  );
}
