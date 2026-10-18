// packages/shell/src/ui/toggle-row.tsx
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

/** A settings toggle: the only UI element that pulses (selection). */
export function onToggle(haptics: HapticsPort): void {
  haptics.play('selection');
}
