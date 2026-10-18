// packages/shell/src/config/google-telemetry.ts
// Node world (read by packages/shell/plugins/with-no-google-telemetry.ts at prebuild). Google Play
// Billing (com.android.billingclient:billing, through expo-iap's openiap-google) logs its own events
// with Google's datatransport library, whose CCT backend uploads them over HTTPS from the app's
// process (CctTransportBackend.doSend -> HttpsURLConnection; E18-T24 caught it on the emulator, a
// connection to Google about a minute after a clean launch, with S2 idle). The app's code makes no
// network request (spec N3), and the runtime check cannot tell this upload from our own, so the
// backend is unregistered: datatransport finds its backends through the meta-data of the
// TransportBackendDiscovery service, and without the "cct" entry DefaultScheduler drops each event
// ("Transport backend 'cct' is not registered") before it is stored or a job is scheduled. The
// scheduler components (JobInfoSchedulerService, AlarmManagerSchedulerBroadcastReceiver) stay
// declared: JobScheduler.schedule() throws for an undeclared service, so removing them could crash.
// Purchases are untouched: billing talks to the Play Store app over IPC, not through datatransport.

import { updateMainApplication } from './main-application.ts';

import type { AndroidManifest, MainApplication } from './main-application.ts';

export const TRANSPORT_BACKEND_DISCOVERY =
  'com.google.android.datatransport.runtime.backends.TransportBackendDiscovery';
export const CCT_BACKEND_META_DATA =
  'backend:com.google.android.datatransport.cct.CctBackendFactory';

type Service = NonNullable<MainApplication['service']>[number];
type MetaData = NonNullable<MainApplication['meta-data']>[number];

const REMOVAL: Service & { readonly 'meta-data': MetaData[] } = {
  $: { 'android:name': TRANSPORT_BACKEND_DISCOVERY, 'tools:node': 'merge' },
  'meta-data': [{ $: { 'android:name': CCT_BACKEND_META_DATA, 'tools:node': 'remove' } }],
};

/**
 * The manifest with the CCT backend's meta-data removed from the merged manifest (tools:node
 * "remove" inside a merged TransportBackendDiscovery); input unchanged, and idempotent.
 */
export function applyNoGoogleTelemetry(manifest: AndroidManifest): AndroidManifest {
  if (manifest.manifest.$['xmlns:tools'] === undefined) {
    throw new Error('AndroidManifest.xml has no xmlns:tools: run ensureToolsAvailable first');
  }
  return updateMainApplication(manifest, (main) => {
    const others = (main.service ?? []).filter(
      (service) => service.$['android:name'] !== TRANSPORT_BACKEND_DISCOVERY,
    );
    return { ...main, service: [...others, REMOVAL] };
  });
}
