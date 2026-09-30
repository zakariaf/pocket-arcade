// packages/shell/src/screens/settings/on-setting-toggled.ts
import { playUiFeedback } from '@e07/shell/services/audio/ui-feedback.ts';

import type { FeedbackPorts } from '@e07/shell/services/audio/ui-feedback.ts';

/** A settings switch flipped: the toggle sound and the selection pulse. */
export function onSettingToggled(ports: FeedbackPorts): void {
  playUiFeedback(ports, 'toggle');
}
