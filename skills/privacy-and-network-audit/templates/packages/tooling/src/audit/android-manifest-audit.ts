// packages/tooling/src/audit/android-manifest-audit.ts
// The merged release AndroidManifest.xml (spec N3): every permission on the allowlist, no plain
// HTTP. The allowlist is the one the APK and store-AAB gates use (privacy-and-network-audit's
// audit-repo checks that this copy matches it): INTERNET, ACCESS_NETWORK_STATE, AD_ID, BILLING,
// VIBRATE, plus what the ads SDK declares (Privacy Sandbox, WorkManager) and androidx.core's
// receiver permission for the app's own package.
export const ANDROID_PERMISSION_ALLOWLIST: readonly string[] = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'com.google.android.gms.permission.AD_ID',
  'android.permission.ACCESS_ADSERVICES_AD_ID',
  'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
  'android.permission.ACCESS_ADSERVICES_TOPICS',
  'android.permission.WAKE_LOCK',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.FOREGROUND_SERVICE',
  'com.android.vending.BILLING',
  'android.permission.VIBRATE',
  '<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
];

const PACKAGE_PREFIX = '<package>.';

/**
 * Google Play Billing logs its events through Google's datatransport library, whose CCT backend
 * uploads them over HTTPS from the app's own process (E18-T24). withShell's
 * with-no-google-telemetry plugin removes this meta-data, so the merged manifest must not hold it.
 */
const CCT_BACKEND_META_DATA = 'backend:com.google.android.datatransport.cct.CctBackendFactory';

function attribute(element: string, name: string): string | null {
  return new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(element)?.[1] ?? null;
}

/** Every uses-permission (and -sdk-23) the manifest grants, without tools:node="remove" ones. */
export function manifestPermissions(xml: string): string[] {
  const elements = xml.match(/<uses-permission(?:-sdk-23)?\b[^>]*>/g) ?? [];
  return elements
    .filter((element) => attribute(element, 'tools:node') !== 'remove')
    .map((element) => attribute(element, 'android:name'))
    .filter((name): name is string => name !== null);
}

function isAllowed(permission: string, packageName: string | null): boolean {
  return ANDROID_PERMISSION_ALLOWLIST.some((allowed) =>
    allowed.startsWith(PACKAGE_PREFIX)
      ? packageName !== null &&
        permission === `${packageName}.${allowed.slice(PACKAGE_PREFIX.length)}`
      : permission === allowed,
  );
}

export function manifestProblems(xml: string): string[] {
  const manifest = /<manifest\b[^>]*>/.exec(xml)?.[0];
  if (manifest === undefined) return ['not an AndroidManifest.xml (no <manifest> element)'];
  const packageName = attribute(manifest, 'package');
  const problems = manifestPermissions(xml)
    .filter((permission) => !isAllowed(permission, packageName))
    .map((permission) => `permission ${permission} is not on the allowlist`);
  const application = /<application\b[^>]*>/.exec(xml)?.[0] ?? '';
  if (attribute(application, 'android:usesCleartextTraffic') === 'true') {
    problems.push('android:usesCleartextTraffic is true (plain HTTP)');
  }
  const metaData = xml.match(/<meta-data\b[^>]*>/g) ?? [];
  const hasCctBackend = metaData.some(
    (element) =>
      attribute(element, 'android:name') === CCT_BACKEND_META_DATA &&
      attribute(element, 'tools:node') !== 'remove',
  );
  if (hasCctBackend) {
    problems.push(
      `Google's datatransport CCT backend is registered (${CCT_BACKEND_META_DATA}): Play Billing would upload its telemetry from the app; withShell's with-no-google-telemetry plugin removes it`,
    );
  }
  if (attribute(application, 'android:networkSecurityConfig') !== null) {
    problems.push(
      'android:networkSecurityConfig is set (it can allow plain HTTP or user certificates)',
    );
  }
  return problems;
}
