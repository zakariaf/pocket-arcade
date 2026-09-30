// packages/shell/src/game-host/finish-run.ts
import { playUiFeedback } from '@e07/shell/services/audio/ui-feedback.ts';

import type { FeedbackPorts } from '@e07/shell/services/audio/ui-feedback.ts';

/** The run's result is decided: one win or lose sound and pulse, before the Result screen. */
export function finishRun(ports: FeedbackPorts, isWon: boolean): void {
  playUiFeedback(ports, 'win');
}
