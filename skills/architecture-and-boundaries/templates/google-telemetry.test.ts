// packages/shell/src/config/google-telemetry.test.ts
import {
  applyNoGoogleTelemetry,
  CCT_BACKEND_META_DATA,
  TRANSPORT_BACKEND_DISCOVERY,
} from './google-telemetry.ts';

import type { AndroidManifest } from './backup-rules.ts';

// The XML namespaces, without spelling out their URLs in app code (N3 lint).
const ANDROID_NAMESPACE = 'android-namespace';
const TOOLS_NAMESPACE = 'tools-namespace';

function manifestWith(
  services: NonNullable<AndroidManifest['manifest']['application']>[number]['service'],
): AndroidManifest {
  return {
    manifest: {
      $: { 'xmlns:android': ANDROID_NAMESPACE, 'xmlns:tools': TOOLS_NAMESPACE },
      queries: [],
      application: [
        {
          $: { 'android:name': '.MainApplication' },
          ...(services === undefined ? {} : { service: services }),
        },
      ],
    },
  };
}

const OWN_SERVICE = { $: { 'android:name': '.OwnService', 'android:exported': 'false' as const } };

describe('applyNoGoogleTelemetry', () => {
  it('names the CCT backend Play Billing uploads its telemetry through (spec N3)', () => {
    expect(TRANSPORT_BACKEND_DISCOVERY).toBe(
      'com.google.android.datatransport.runtime.backends.TransportBackendDiscovery',
    );
    expect(CCT_BACKEND_META_DATA).toBe(
      'backend:com.google.android.datatransport.cct.CctBackendFactory',
    );
  });

  it("removes the CCT backend from the merged manifest, so Google's datatransport never uploads (spec N3)", () => {
    const next = applyNoGoogleTelemetry(manifestWith([OWN_SERVICE]));
    expect(next.manifest.application?.[0]?.service).toStrictEqual([
      OWN_SERVICE,
      {
        $: { 'android:name': TRANSPORT_BACKEND_DISCOVERY, 'tools:node': 'merge' },
        'meta-data': [{ $: { 'android:name': CCT_BACKEND_META_DATA, 'tools:node': 'remove' } }],
      },
    ]);
  });

  it('keeps the scheduler components, so no job is ever scheduled against a missing service', () => {
    const next = applyNoGoogleTelemetry(manifestWith(undefined));
    const names = (next.manifest.application?.[0]?.service ?? []).map(
      (service) => service.$['android:name'],
    );
    expect(names).toStrictEqual([TRANSPORT_BACKEND_DISCOVERY]);
  });

  it('writes the entry once when it runs twice, and leaves its input unchanged', () => {
    const manifest = manifestWith([OWN_SERVICE]);
    const twice = applyNoGoogleTelemetry(applyNoGoogleTelemetry(manifest));
    expect(twice.manifest.application?.[0]?.service).toHaveLength(2);
    expect(manifest.manifest.application?.[0]?.service).toStrictEqual([OWN_SERVICE]);
  });

  it('refuses a manifest without the tools namespace or an application', () => {
    const noTools: AndroidManifest = {
      manifest: { $: { 'xmlns:android': ANDROID_NAMESPACE }, queries: [], application: [] },
    };
    expect(() => applyNoGoogleTelemetry(noTools)).toThrow('xmlns:tools');
    const noApplication: AndroidManifest = {
      manifest: {
        $: { 'xmlns:android': ANDROID_NAMESPACE, 'xmlns:tools': TOOLS_NAMESPACE },
        queries: [],
      },
    };
    expect(() => applyNoGoogleTelemetry(noApplication)).toThrow(
      'AndroidManifest.xml has no <application>',
    );
  });
});
