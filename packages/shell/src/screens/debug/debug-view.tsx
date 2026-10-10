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
import { DebugPerfSection } from './debug-perf-section.tsx';
import { DEBUG_ROWS } from './debug-rows.ts';

import type { DebugImportField } from './debug-import-save.tsx';
import type { DebugPerf } from './debug-perf-section.tsx';
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
  /** Debug menu > Performance, drawn below the counter (DEBUG_PERF_ROWS and the summary line). */
  readonly perf: DebugPerf;
  readonly isReducedMotion: boolean;
  readonly onBack: () => void;
  readonly onAction: (action: DebugAction) => void;
  readonly onToggle: (id: DebugSwitch) => void;
};

export type { DebugImportField } from './debug-import-save.tsx';
export type { DebugPerf } from './debug-perf-section.tsx';

export type DebugViewProps = { readonly model: DebugModel };

const styles = StyleSheet.create({
  // A Sticker aligns itself to the top of its row (alignSelf flex-start); the design centres the
  // "Test build" badge in the bar, below the hazard strip (it sat 13.6 pt high, over the strip).
  badge: { alignSelf: 'center' },
  // The counter sits under the list, start-aligned, as wide as its text.
  footer: { alignSelf: 'flex-start', paddingTop: 8, paddingHorizontal: 4 },
});

/**
 * Every debug text is English in every language (L13), drawn with the language's font and line
 * height. In fa and ckb a label is an LTR paragraph aligned to the row's start, as the design lays
 * an English run in an RTL row: wrapped lines flush with the start ("Force language, direction and
 * digits" sat 4.4 pt off when laid right to left). Values keep the language's own digits.
 */
const LABEL_DIRECTION = 'ltr';

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
 * S15 Debug menu (test builds only), top to bottom as the design: the hazard strip under the
 * status bar, then the top bar with the "Test build" sticker centred in it, one list of fourteen
 * tools, the Import save field while that row is open, the network counter, and the Performance
 * group below the design's rows. Compiled out of store builds through TEST_ONLY.
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
          <View style={styles.badge}>
            <Sticker
              testID="debug.top-bar.badge"
              text={t('debug.badge')}
              paper="ink"
              size="sm"
              icon="bug"
              tiltDeg={5}
            />
          </View>
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
              labelDirection={LABEL_DIRECTION}
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
        <DebugPerfSection perf={model.perf} isReducedMotion={model.isReducedMotion} />
      </ScreenBody>
    </ScreenFrame>
  );
}
