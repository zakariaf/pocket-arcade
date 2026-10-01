// packages/shell/src/config/with-shell.ts (fixture: the parts the N3 audit reads)
import { PRIVACY_MANIFESTS } from './privacy-manifest.ts';
import { shellPlugins, TRACKING_USAGE_DESCRIPTIONS } from './shell-plugins.ts';

const LANGUAGES = ['en', 'de', 'fa', 'ckb'] as const;

export function withShell(): Record<string, unknown> {
  return {
    ios: { bundleIdentifier: 'io.applander.demogame', privacyManifests: PRIVACY_MANIFESTS },
    locales: Object.fromEntries(
      LANGUAGES.map((lang) => [lang, { ios: { NSUserTrackingUsageDescription: TRACKING_USAGE_DESCRIPTIONS[lang] } }]),
    ),
    updates: { enabled: false },
    plugins: shellPlugins(),
  };
}
