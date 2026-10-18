// packages/shell/plugins/with-app-variant-marker.ts
import { AndroidConfig, withAndroidManifest, withInfoPlist } from 'expo/config-plugins.js';

import type { ConfigPlugin } from 'expo/config-plugins.js';

type Options = { readonly appVariant: string };

/**
 * Writes E07AppVariant into Info.plist and, on Android, as <application> meta-data, so the
 * store-artifact gates (check-store-artifact, check-emu-app's `variant`) can assert 'store'.
 */
const withAppVariantMarker: ConfigPlugin<Options> = (config, { appVariant }) => {
  const withPlist = withInfoPlist(config, (next) => ({
    ...next,
    modResults: { ...next.modResults, E07AppVariant: appVariant },
  }));
  return withAndroidManifest(withPlist, (next) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(next.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      'E07AppVariant',
      appVariant,
    );
    return next;
  });
};

/** @public Loaded by Expo from withShell's path string, so it must be the default export. */
export default withAppVariantMarker;
