// packages/shell/plugins/with-no-google-telemetry.ts
import { AndroidConfig, withAndroidManifest } from 'expo/config-plugins.js';

import { applyNoGoogleTelemetry } from '@e07/shell/config/google-telemetry.ts';

import type { ConfigPlugin } from 'expo/config-plugins.js';

/** Unregisters datatransport's CCT backend, so Play Billing's telemetry never leaves the app (N3). */
const withNoGoogleTelemetry: ConfigPlugin = (config) =>
  withAndroidManifest(config, (next) => ({
    ...next,
    modResults: applyNoGoogleTelemetry(
      AndroidConfig.Manifest.ensureToolsAvailable(next.modResults),
    ),
  }));

/** @public Loaded by Expo from withShell's path string, so it must be the default export. */
export default withNoGoogleTelemetry;
