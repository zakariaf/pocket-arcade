// packages/shell/plugins/with-prepared-text-layout.ts
import { withMainApplication } from 'expo/config-plugins.js';

import { applyPreparedTextLayout } from '@e07/shell/config/prepared-text-layout.ts';

import type { ConfigPlugin } from 'expo/config-plugins.js';

/** Draws each Text with the layout React Native measured, so Android 15+ never wraps it again. */
const withPreparedTextLayout: ConfigPlugin = (config) =>
  withMainApplication(config, (next) => {
    if (next.modResults.language !== 'kt') {
      throw new Error(
        'with-prepared-text-layout expects the Kotlin MainApplication of Expo SDK 57',
      );
    }
    return {
      ...next,
      modResults: {
        ...next.modResults,
        contents: applyPreparedTextLayout(next.modResults.contents),
      },
    };
  });

/** @public Loaded by Expo from withShell's path string, so it must be the default export. */
export default withPreparedTextLayout;
