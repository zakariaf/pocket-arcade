// packages/shell/src/screens/dialogs/dialog-host.tsx
// Fixture: toybox-screens' S14 host with the Android system back wired as the open dialog's cancel.
import { useHardwareBack } from '@e07/shell/navigation/use-hardware-back.ts';

import { ResetStatsDialog } from './reset-stats-dialog.tsx';

import type { DialogRequest } from './dialog-request.ts';
import type { ReactNode } from 'react';

export type DialogHostProps = {
  readonly request: DialogRequest | null;
  readonly onClose: () => void;
  readonly isReducedMotion: boolean;
};

export function DialogHost({ request, onClose, isReducedMotion }: DialogHostProps): ReactNode {
  // Android's system back is the open dialog's cancel; every S14 cancel (Cancel, Later, OK) closes.
  useHardwareBack(request === null ? null : onClose);
  if (request === null) return null;
  return (
    <ResetStatsDialog
      onConfirm={() => {
        request.onConfirm();
        onClose();
      }}
      onCancel={onClose}
      isReducedMotion={isReducedMotion}
    />
  );
}
