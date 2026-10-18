// packages/shell/src/config/main-application.ts
// Node world (read by the Android config plugins in packages/shell/plugins/ at prebuild): the one
// way the Shell changes the <application> element prebuild writes into AndroidManifest.xml (backup
// rules, RTL support, the telemetry removal), without changing the manifest it was given.

import type { AndroidConfig } from 'expo/config-plugins.js';

export type AndroidManifest = AndroidConfig.Manifest.AndroidManifest;

/** The <application> element, as the manifest's parsed XML holds it. */
export type MainApplication = NonNullable<AndroidManifest['manifest']['application']>[number];

/**
 * The manifest with its first <application> replaced by `update` of it, the others kept; the input
 * is unchanged. Throws when there is none: prebuild did not write the app.
 */
export function updateMainApplication(
  manifest: AndroidManifest,
  update: (application: MainApplication) => MainApplication,
): AndroidManifest {
  const [main, ...rest] = manifest.manifest.application ?? [];
  if (main === undefined) {
    throw new Error('AndroidManifest.xml has no <application>: prebuild did not write the app');
  }
  return { ...manifest, manifest: { ...manifest.manifest, application: [update(main), ...rest] } };
}
