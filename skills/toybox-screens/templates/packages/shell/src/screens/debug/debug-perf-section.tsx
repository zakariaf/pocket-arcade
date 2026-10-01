// packages/shell/src/screens/debug/debug-perf-section.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { LAYOUT } from '@e07/shell/theme/tokens.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { RowButton } from '@e07/shell/ui/row-button.tsx';
import { ToggleKey } from '@e07/shell/ui/toggle-key.tsx';

import { DEBUG_PERF_ROWS } from './debug-rows.ts';

import type { ReactNode } from 'react';

/**
 * Debug menu > Performance (test builds only), filled by e2e-maestro's use-debug-model.ts from
 * DebugServices.perf (the perf layer's DebugPerfActions) over the test build's perf log.
 */
export type DebugPerf = {
  /** debug.perf-record-switch: frame times go into the perf log while it is on. */
  readonly isRecording: boolean;
  readonly onToggleRecording: () => void;
  /** debug.perf-share-row: the iOS share sheet with the perf log as JSON (the app sends nothing). */
  readonly onShare: () => void;
  /** debug.perf-benchmark-row: 300 save writes into a scratch database, one save-benchmark entry. */
  readonly onRunBenchmark: () => void;
  /** PerfLog.entries().length: the count debug.perf.summary names. */
  readonly entriesCount: number;
  /** The log's numbers, never translated: "cold 3 · 1049 ms · save p95 0.41 ms". */
  readonly summary: string;
};

export type DebugPerfSectionProps = {
  readonly perf: DebugPerf;
  readonly isReducedMotion: boolean;
};

const styles = StyleSheet.create({
  section: { gap: LAYOUT.blockGap, paddingTop: LAYOUT.blockGap },
  // The switch key keeps its content height and spans the body, as a Pause key spans its cell.
  switchRow: { flexDirection: 'row' },
  summary: { alignSelf: 'flex-start', paddingHorizontal: 4 },
});

/**
 * The Performance group under the design's rows (the design draws none): its heading, the
 * record switch, Share performance report and Run save benchmark (DEBUG_PERF_ROWS), and one
 * summary line (`debug.perf-summary`: the log's entry count, then its cold starts and the newest
 * save benchmark). English in every language, like every debug text.
 */
export function DebugPerfSection({ perf, isReducedMotion }: DebugPerfSectionProps): ReactNode {
  const t = useT();
  const count = t('debug.perf.summary', { entriesCount: perf.entriesCount });
  return (
    <View style={styles.section}>
      <AppText text={t('debug.perf.heading')} variant="heading" isHeader />
      {DEBUG_PERF_ROWS.map((row) =>
        row.id === 'record' ? (
          <View key={row.id} style={styles.switchRow}>
            <ToggleKey
              testID={row.testID}
              icon={row.icon}
              label={t(row.labelKey)}
              stateLabel={t(perf.isRecording ? 'common.on' : 'common.off')}
              isOn={perf.isRecording}
              onToggle={perf.onToggleRecording}
              isReducedMotion={isReducedMotion}
            />
          </View>
        ) : (
          <RowButton
            key={row.id}
            testID={row.testID}
            icon={row.icon}
            label={t(row.labelKey)}
            onPress={row.id === 'share' ? perf.onShare : perf.onRunBenchmark}
            isReducedMotion={isReducedMotion}
          />
        ),
      )}
      <View style={styles.summary}>
        <AppText
          testID="debug.perf-summary"
          text={`${count} · ${perf.summary}`}
          variant="settingsFooter"
          tone="muted"
        />
      </View>
    </View>
  );
}
