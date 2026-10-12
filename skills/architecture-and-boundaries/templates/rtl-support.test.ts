// packages/shell/src/config/rtl-support.test.ts
import { applyRtlSupport } from './rtl-support.ts';

import type { AndroidManifest } from './backup-rules.ts';

// The android XML namespace, without spelling out its URL in app code (N3 lint).
const ANDROID_NAMESPACE = 'android-namespace';

function manifestWith(attributes: Record<string, string>): AndroidManifest {
  return {
    manifest: {
      $: { 'xmlns:android': ANDROID_NAMESPACE },
      queries: [],
      application: [{ $: { 'android:name': '.MainApplication', ...attributes } }],
    },
  };
}

describe('applyRtlSupport', () => {
  it('lets Android lay out right to left for fa and ckb (spec N11)', () => {
    const manifest = manifestWith({ 'android:supportsRtl': 'false', 'android:label': 'Probe' });
    expect(applyRtlSupport(manifest).manifest.application?.[0]?.$).toStrictEqual({
      'android:name': '.MainApplication',
      'android:label': 'Probe',
      'android:supportsRtl': 'true',
    });
    expect(manifest.manifest.application?.[0]?.$['android:supportsRtl']).toBe('false');
  });

  it('refuses a manifest without an application', () => {
    expect(() =>
      applyRtlSupport({ manifest: { $: { 'xmlns:android': ANDROID_NAMESPACE }, queries: [] } }),
    ).toThrow('AndroidManifest.xml has no <application>');
  });
});
