// packages/shell/src/app/perf/perf-report-header.ts
import type { PerfReportHeader } from './share-perf-report.ts';

/** The build's ids as Constants.expoConfig carries them: only the fields the header reads. */
export type BuildIds = {
  readonly version?: string;
  readonly ios?: { readonly bundleIdentifier?: string; readonly buildNumber?: string };
  readonly android?: { readonly package?: string; readonly versionCode?: number };
};

/** Platform.OS and Platform.Version of the phone the report comes from. */
type DevicePlatform = { readonly OS: string; readonly Version: string | number };

type StoreIds = { readonly appId: string | undefined; readonly buildNumber: string | undefined };

/** Google Play's ids: the package and the versionCode (a number in app.config.ts). */
function androidIds(ids: BuildIds | null | undefined): StoreIds {
  const versionCode = ids?.android?.versionCode;
  return {
    appId: ids?.android?.package,
    buildNumber: versionCode === undefined ? undefined : String(versionCode),
  };
}

/** The App Store's ids: the bundle identifier and the build number. */
function iosIds(ids: BuildIds | null | undefined): StoreIds {
  return { appId: ids?.ios?.bundleIdentifier, buildNumber: ids?.ios?.buildNumber };
}

/** The shared report's header: the store id and build number of the platform it runs on. */
export function perfReportHeaderOf(
  ids: BuildIds | null | undefined,
  platform: DevicePlatform,
): PerfReportHeader {
  const store = platform.OS === 'android' ? androidIds(ids) : iosIds(ids);
  return {
    appId: store.appId ?? 'unknown',
    appVersion: ids?.version ?? 'unknown',
    buildNumber: store.buildNumber ?? 'unknown',
    deviceModel: `${platform.OS} ${String(platform.Version)}`,
  };
}
