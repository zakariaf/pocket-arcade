// packages/shell/src/app/perf/share-perf-report.ts
// device-only: covered by the debug menu's "Share performance report" on the simulator (the iOS share sheet)
import { Share } from 'react-native';

import type { PerfLog } from './perf-log.ts';

export type PerfReportHeader = {
  readonly appId: string;
  readonly appVersion: string;
  readonly buildNumber: string;
  readonly deviceModel: string;
};

/**
 * Debug menu (S15, test builds) > Performance > "Share performance report". Opens the iOS share
 * sheet with JSON; the owner AirDrops or pastes it to Claude. Nothing is sent by our code (N3).
 * The debug menu reaches it through the test-only entry, which knip cannot follow.
 * @public
 */
export async function sharePerfReport(log: PerfLog, header: PerfReportHeader): Promise<void> {
  const message = JSON.stringify({ ...header, entries: log.entries() }, null, 1);
  await Share.share({ message });
}
