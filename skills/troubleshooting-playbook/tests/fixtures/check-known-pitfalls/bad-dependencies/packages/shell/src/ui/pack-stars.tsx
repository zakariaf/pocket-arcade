// packages/shell/src/ui/pack-stars.tsx
import { useShallow } from 'zustand/shallow';

import { useProgressStore } from '../stores/progress/progress-store.ts';
import { useSettingsStore } from '../stores/settings/settings-store.ts';

export function usePackStars(pack: string): readonly number[] {
  const isColorBlind = useSettingsStore((state) => state.settings.colorBlind);
  return useProgressStore(useShallow((state) => (isColorBlind ? [] : state.stars[pack] ?? [])));
}
