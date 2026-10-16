// packages/shell/plugins/with-rtl-support.ts
import { withAndroidManifest } from 'expo/config-plugins.js';

import { applyRtlSupport } from '@e07/shell/config/rtl-support.ts';

import type { ConfigPlugin } from 'expo/config-plugins.js';

/** Declares android:supportsRtl so fa and ckb screens can lay out right to left. */
const withRtlSupport: ConfigPlugin = (config) =>
  withAndroidManifest(config, (next) => ({
    ...next,
    modResults: applyRtlSupport(next.modResults),
  }));

/** @public Loaded by Expo from withShell's path string, so it must be the default export. */
export default withRtlSupport;
