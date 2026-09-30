// packages/shell/src/screens/dialogs/reset-progress-dialog.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { HoldButton } from '@e07/shell/ui/hold-button.tsx';
import { HOLD_TO_CONFIRM_MS } from '@e07/shell/ui/use-hold-to-confirm.ts';

import { DialogFrame } from './dialog-frame.tsx';

import type { ReactNode } from 'react';

export type ResetProgressDialogProps = {
  /** Deletes levels, stars, run, daily results and statistics; never settings, first-run or Premium. */
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly isReducedMotion: boolean;
  /** Test builds: the hold held still at this share (the s14-reset-all-progress frame, 0.46). */
  readonly frozenProgress?: number;
};

const MS_PER_SECOND = 1000;
const HOLD_SECONDS = HOLD_TO_CONFIRM_MS / MS_PER_SECOND;

/**
 * S14 "Reset all progress?" over Settings: the danger HoldButton fills from the start edge for
 * 2 s (a functional timer, kept under Reduce motion; `.fill` is its part); VoiceOver confirms
 * with the activate action instead. The hint line under it says how long to hold.
 */
export function ResetProgressDialog({
  onConfirm,
  onCancel,
  isReducedMotion,
  frozenProgress,
}: ResetProgressDialogProps): ReactNode {
  const t = useT();
  const holdHint = t('dialog.reset-progress.hold-hint', { seconds: HOLD_SECONDS });
  return (
    <DialogFrame
      scope="reset-progress-dialog"
      art={{ icon: 'trash', paint: 'danger', size: 'dialog' }}
      title={t('dialog.reset-progress.title')}
      body={t('dialog.reset-progress.body')}
    >
      <HoldButton
        testID="reset-progress-dialog.confirm-button"
        label={t('dialog.reset-progress.confirm')}
        hint={holdHint}
        onConfirm={onConfirm}
        icon="trash"
        isReducedMotion={isReducedMotion}
        {...(frozenProgress === undefined ? {} : { frozenProgress })}
      />
      <AppText
        text={holdHint}
        variant="caption"
        tone="muted"
        testID="reset-progress-dialog.hold-hint"
      />
      <Button
        testID="reset-progress-dialog.cancel-button"
        label={t('common.cancel')}
        onPress={onCancel}
        isBlock
        isReducedMotion={isReducedMotion}
      />
    </DialogFrame>
  );
}
