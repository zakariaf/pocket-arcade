// packages/shell/src/screens/pause/pause-toggles.tsx
import { View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { ToggleKey } from '@e07/shell/ui/toggle-key.tsx';
import { usePairLayout } from '@e07/shell/ui/use-pair-layout.ts';

import type { PauseModel, PauseSwitch } from './pause-model.ts';
import type { IconName } from '@e07/shell/ui/icons/icon-paths.ts';
import type { ReactNode } from 'react';

export type PauseTogglesProps = { readonly model: PauseModel };

type PauseToggleKey = {
  readonly testID: string;
  readonly icon: IconName;
  readonly label: string;
  readonly toggle: PauseSwitch | null;
};

/** S6 toggle keys in a 3-column grid (gap 10): Sound, Music, Vibration, each "On" or "Off". */
export function PauseToggles({ model }: PauseTogglesProps): ReactNode {
  const t = useT();
  const layout = usePairLayout(10);
  const { isReducedMotion } = model;
  // Music is null for a game without music, Vibration on a device without haptics: no key then.
  const keys: readonly PauseToggleKey[] = [
    { testID: 'pause.sound-switch', icon: 'sound', label: t('pause.sound'), toggle: model.sound },
    { testID: 'pause.music-switch', icon: 'music', label: t('pause.music'), toggle: model.music },
    {
      testID: 'pause.vibration-switch',
      icon: 'vibration',
      label: t('pause.vibration'),
      toggle: model.vibration,
    },
  ];
  return (
    <View style={layout.row} testID="pause.toggles">
      {keys.map(({ testID, icon, label, toggle }) =>
        toggle === null ? null : (
          <View key={testID} style={layout.item}>
            <ToggleKey
              testID={testID}
              icon={icon}
              label={label}
              stateLabel={t(toggle.isOn ? 'common.on' : 'common.off')}
              isOn={toggle.isOn}
              onToggle={toggle.onToggle}
              isReducedMotion={isReducedMotion}
            />
          </View>
        ),
      )}
    </View>
  );
}
