// packages/shell/src/screens/debug/debug-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { HazardStrip } from '@e07/shell/ui/hazard-strip.tsx';
import { ListRow } from '@e07/shell/ui/list-row.tsx';
import { List } from '@e07/shell/ui/list.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';

import { DebugImportSave } from './debug-import-save.tsx';
import { DEBUG_ROWS } from './debug-rows.ts';

import type { DebugImportField } from './debug-import-save.tsx';
import type { DebugAction, DebugRow, DebugSwitch, DebugValue } from './debug-rows.ts';
import type { ListRowProps } from '@e07/shell/ui/list-row.tsx';
import type { ReactNode } from 'react';

export type DebugModel = {
  /** level: "12"; date: date.weekday-day-month; locale: "en · ltr · 123" (isolated LTR); errors: count. */
  readonly values: Readonly<Record<DebugValue, string>>;
  readonly switches: Readonly<Record<DebugSwitch, boolean>>;
  /**
   * The JS network guard's blocked attempts ("0" in a healthy build): drawn under the list as
   * debug.network-attempts, which every E2E smoke flow asserts (e2e-maestro). Not in the design.
   */
  readonly networkAttempts: string;
  /** The Import save row's paste field (drawn under the list while it is open). */
  readonly importField: DebugImportField;
  readonly isReducedMotion: boolean;
  readonly onBack: () => void;
  readonly onAction: (action: DebugAction) => void;
  readonly onToggle: (id: DebugSwitch) => void;
};

export type { DebugImportField } from './debug-import-save.tsx';

export type DebugViewProps = { readonly model: DebugModel };

/** The counter sits under the list, start-aligned, as wide as its text. */
const styles = StyleSheet.create({
  footer: { alignSelf: 'flex-start', paddingTop: 8, paddingHorizontal: 4 },
});

/** A switch row flips a test flag (the whole row is the switch); a chevron row runs a tool. */
function rowProps(row: DebugRow, model: DebugModel): Partial<ListRowProps> {
  const { action, switchId, value } = row;
  const shown = value === undefined ? {} : { value: model.values[value] };
  if (switchId !== undefined) {
    return {
      ...shown,
      end: 'toggle',
      isOn: model.switches[switchId],
      onPress: () => {
        model.onToggle(switchId);
      },
    };
  }
  if (action !== undefined) {
    return {
      ...shown,
      end: 'chevron',
      onPress: () => {
        model.onAction(action);
      },
    };
  }
  return shown;
}

/**
 * S15 Debug menu (test builds only): the hazard strip, a top bar with the "Test build" sticker,
 * one list of fourteen tools, the Import save field while that row is open, and the network
 * counter. Compiled out of store builds through TEST_ONLY.
 */
export function DebugView({ model }: DebugViewProps): ReactNode {
  const t = useT();
  return (
    <ScreenFrame testID="debug.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <HazardStrip testID="debug.hazard-strip" />
      <TopBar
        testID="debug.top-bar"
        title={t('debug.title')}
        backLabel={t('common.back')}
        onBack={model.onBack}
        end={
          <Sticker
            testID="debug.top-bar.badge"
            text={t('debug.badge')}
            paper="ink"
            size="sm"
            icon="bug"
            tiltDeg={5}
          />
        }
        isReducedMotion={model.isReducedMotion}
      />
      <ScreenBody isUnderHomeIndicator>
        <List testID="debug.list">
          {DEBUG_ROWS.map((row, index) => (
            <ListRow
              key={row.testID}
              testID={row.testID}
              label={t(row.labelKey)}
              icon={row.icon}
              iconPaint={row.iconPaint ?? 'pop'}
              isFirst={index === 0}
              isReducedMotion={model.isReducedMotion}
              {...rowProps(row, model)}
            />
          ))}
        </List>
        {model.importField.isOpen ? (
          <DebugImportSave field={model.importField} isReducedMotion={model.isReducedMotion} />
        ) : null}
        <View style={styles.footer}>
          <AppText
            testID="debug.network-attempts"
            text={model.networkAttempts}
            variant="settingsFooter"
            tone="muted"
          />
        </View>
      </ScreenBody>
    </ScreenFrame>
  );
}
