// packages/shell/src/screens/settings/settings-view.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { ListGroup } from '@e07/shell/ui/list-group.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';

import { SettingsFooter } from './settings-footer.tsx';
import { SETTINGS_GROUP_TABS } from './settings-row-specs.ts';
import { SettingsRow } from './settings-row.tsx';

import type { SettingsExtras } from './settings-extras.ts';
import type { SettingsModel } from './use-settings-model.ts';
import type { ReactNode } from 'react';

export type SettingsViewProps = {
  readonly model: SettingsModel;
  readonly extras: SettingsExtras;
};

/**
 * S11 Settings (body gap 20): seven group tabs over their lists, in the order and with the rows
 * settingsGroupsFor() decides (hidden rows are left out, never greyed), then the footer. No banner.
 */
export function SettingsView({ model, extras }: SettingsViewProps): ReactNode {
  const t = useT();
  return (
    <ScreenFrame testID="settings.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <TopBar
        testID="settings.top-bar"
        title={t('common.settings')}
        backLabel={t('common.back')}
        onBack={extras.onBack}
        isReducedMotion={model.isReducedMotion}
      />
      <ScreenBody gap="settings" isUnderHomeIndicator>
        {model.groups.map((group) => {
          const tab = SETTINGS_GROUP_TABS[group.id];
          return (
            <ListGroup key={group.id} testID={group.testID} title={t(tab.titleKey)} icon={tab.icon}>
              {group.rows.map((row, index) => (
                <SettingsRow
                  key={row}
                  id={row}
                  model={model}
                  extras={extras}
                  isFirst={index === 0}
                />
              ))}
            </ListGroup>
          );
        })}
        <SettingsFooter versionText={extras.versionText} />
      </ScreenBody>
    </ScreenFrame>
  );
}
