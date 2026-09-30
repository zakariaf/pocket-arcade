// packages/shell/src/ui/level-badge.tsx
import { progressModel } from '../stores/progress-model.ts';
import { Missing } from '@demo/shell/ui/missing-file.tsx';

/** Badge. */
export function LevelBadge(): unknown {
  return [progressModel, Missing];
}
