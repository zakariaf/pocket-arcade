// packages/shell/src/app/use-checkpoint-on-background.ts
import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { SaveService } from '@e07/shell/services/save/save-service.ts';

/**
 * Folds the WAL into save.db when the app leaves the foreground, so an iCloud/device
 * backup taken while the app is suspended holds one self-contained file (D5).
 */
export function useCheckpointOnBackground(save: SaveService): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') save.checkpoint();
    });
    return () => {
      subscription.remove();
    };
  }, [save]);
}
