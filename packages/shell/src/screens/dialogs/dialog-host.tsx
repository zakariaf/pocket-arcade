// packages/shell/src/screens/dialogs/dialog-host.tsx
import { NewerSaveDialog } from './newer-save-dialog.tsx';
import { ResetProgressDialog } from './reset-progress-dialog.tsx';
import { ResetStatsDialog } from './reset-stats-dialog.tsx';
import { RestartDialog } from './restart-dialog.tsx';
import { RestartLevelDialog } from './restart-level-dialog.tsx';
import { SaveRestoredDialog } from './save-restored-dialog.tsx';

import type { DialogRequest } from './dialog-request.ts';
import type { ReactNode } from 'react';

export type DialogHostProps = {
  /** The one dialog to show, or null for none. */
  readonly request: DialogRequest | null;
  readonly onClose: () => void;
  readonly isReducedMotion: boolean;
};

/**
 * S14's host: at most one dialog, drawn above the navigator (never a route, never persisted).
 * Every button closes the dialog; the action button runs its callback first.
 */
export function DialogHost({ request, onClose, isReducedMotion }: DialogHostProps): ReactNode {
  if (request === null) return null;
  const closeAfter = (action: () => void) => (): void => {
    action();
    onClose();
  };
  const motion = { isReducedMotion };
  switch (request.kind) {
    case 'reset-stats':
      return (
        <ResetStatsDialog
          onConfirm={closeAfter(request.onConfirm)}
          onCancel={onClose}
          {...motion}
        />
      );
    case 'reset-progress':
      return (
        <ResetProgressDialog
          onConfirm={closeAfter(request.onConfirm)}
          onCancel={onClose}
          {...(request.frozenProgress === undefined
            ? {}
            : { frozenProgress: request.frozenProgress })}
          {...motion}
        />
      );
    case 'restart-to-apply':
      return (
        <RestartDialog onRestart={closeAfter(request.onRestart)} onLater={onClose} {...motion} />
      );
    case 'restart-level':
      return (
        <RestartLevelDialog
          onRestart={closeAfter(request.onRestart)}
          onCancel={onClose}
          {...motion}
        />
      );
    case 'save-restored':
      return <SaveRestoredDialog onOk={onClose} {...motion} />;
    case 'newer-save':
      return (
        <NewerSaveDialog
          gameName={request.gameName}
          onUpdate={closeAfter(request.onUpdate)}
          onLater={onClose}
          {...motion}
        />
      );
  }
}
