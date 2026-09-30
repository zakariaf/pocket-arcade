import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { ReactNode } from 'react';

export function SoundBadge(): ReactNode {
  const isOn = useSettingsStore((state) => state.settings.soundEnabled);
  return isOn ? null : null;
}
