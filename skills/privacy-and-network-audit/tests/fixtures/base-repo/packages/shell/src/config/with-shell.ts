// packages/shell/src/config/with-shell.ts (fixture: the parts the N3 audit reads)
import { PRIVACY_MANIFESTS } from './privacy-manifest.ts';

export function withShell(): Record<string, unknown> {
  return {
    ios: { bundleIdentifier: 'com.example.demogame', privacyManifests: PRIVACY_MANIFESTS },
    updates: { enabled: false },
    plugins: ['expo-sqlite', 'expo-iap', ['react-native-google-mobile-ads', { iosAppId: 'from admobPluginOptions' }]],
  };
}
