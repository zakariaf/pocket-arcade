// packages/shell/src/app/perf/perf-report-header.ts
import { buildNumberOf } from '@e07/shell/app/build-number.ts';

import type { PerfReportHeader } from './share-perf-report.ts';
import type { NativeBuildConfig } from '@e07/shell/app/build-number.ts';

/** The build's ids as Constants.expoConfig carries them: only the fields the header reads. */
export type BuildIds = NativeBuildConfig & {
  readonly version?: string;
  readonly ios?: { readonly bundleIdentifier?: string };
  readonly android?: { readonly package?: string };
};

/** Platform.OS and Platform.Version of the phone the report comes from. */
type DevicePlatform = { readonly OS: string; readonly Version: string | number };

/** The shared report's header: the store id and build number of the platform it runs on. */
export function perfReportHeaderOf(
  ids: BuildIds | null | undefined,
  platform: DevicePlatform,
): PerfReportHeader {
  const appId = platform.OS === 'android' ? ids?.android?.package : ids?.ios?.bundleIdentifier;
  return {
    appId: appId ?? 'unknown',
    appVersion: ids?.version ?? 'unknown',
    buildNumber: buildNumberOf(ids, platform.OS) ?? 'unknown',
    deviceModel: `${platform.OS} ${String(platform.Version)}`,
  };
}
