// packages/shell/plugins/with-app-variant-marker.ts
import { withInfoPlist } from 'expo/config-plugins.js';

import type { ConfigPlugin } from 'expo/config-plugins.js';

type Options = { readonly appVariant: string };

const withAppVariantMarker: ConfigPlugin<Options> = (config, { appVariant }) =>
  withInfoPlist(config, (next) => ({ ...next, modResults: { ...next.modResults, E07AppVariant: appVariant } }));

/** @public Loaded by Expo from withShell's path string. */
export default withAppVariantMarker;
