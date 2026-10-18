// packages/shell/src/config/rtl-support.ts
// Node world (read by packages/shell/plugins/with-rtl-support.ts at prebuild): Android lays a
// screen out right to left only when the application declares android:supportsRtl. Expo's template
// sets it today; writing it here keeps fa and ckb right to left if the template ever changes. The
// direction itself is chosen in the app (rtl-and-direction), never by expo-localization's
// supportsRTL option.

import { updateMainApplication } from './main-application.ts';

import type { AndroidManifest } from './main-application.ts';

/** The manifest with android:supportsRtl="true" on its <application>; input unchanged. */
export function applyRtlSupport(manifest: AndroidManifest): AndroidManifest {
  return updateMainApplication(manifest, (main) => ({
    ...main,
    $: { ...main.$, 'android:supportsRtl': 'true' },
  }));
}
