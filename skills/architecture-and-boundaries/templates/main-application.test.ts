// packages/shell/src/config/main-application.test.ts
import { updateMainApplication } from './main-application.ts';

import type { AndroidManifest } from './main-application.ts';

// The android XML namespace, without spelling out its URL in app code (N3 lint).
const ANDROID_NAMESPACE = 'android-namespace';

function manifestOf(
  applications: NonNullable<AndroidManifest['manifest']['application']>,
): AndroidManifest {
  return {
    manifest: { $: { 'xmlns:android': ANDROID_NAMESPACE }, queries: [], application: applications },
  };
}

// Spec 8.6 (D5), N3 and N11: the backup rules, the telemetry removal and RTL support all change the
// one <application> prebuild writes, through this helper.
describe('updateMainApplication', () => {
  it('replaces the first <application> with the update and keeps the rest; input unchanged', () => {
    const manifest = manifestOf([
      { $: { 'android:name': '.MainApplication' } },
      { $: { 'android:name': '.Other' } },
    ]);
    const next = updateMainApplication(manifest, (application) => ({
      ...application,
      $: { ...application.$, 'android:supportsRtl': 'true' },
    }));
    expect(next.manifest.application).toStrictEqual([
      { $: { 'android:name': '.MainApplication', 'android:supportsRtl': 'true' } },
      { $: { 'android:name': '.Other' } },
    ]);
    expect(manifest.manifest.application?.[0]).toStrictEqual({
      $: { 'android:name': '.MainApplication' },
    });
  });

  it('throws when prebuild wrote no <application>', () => {
    expect(() => updateMainApplication(manifestOf([]), (application) => application)).toThrow(
      'AndroidManifest.xml has no <application>: prebuild did not write the app',
    );
  });
});
