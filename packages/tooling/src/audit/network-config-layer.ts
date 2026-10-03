// packages/tooling/src/audit/network-config-layer.ts
// Layer E: configuration that would add network paths, plus the App Tracking Transparency text.
// Input: `expo config --json --type prebuild` of a STORE build. Banned npm packages are checked by
// banned-packages.ts in the same run.
// ATT (owner decision O1, 2026-09-30): with ads enabled the app asks for tracking permission after
// Google's consent form, so the prompt text must exist in every app language: the
// expo-tracking-transparency plugin's userTrackingPermission (Info.plist, en) and withShell's
// locales.<lang>.ios.NSUserTrackingUsageDescription (InfoPlist.strings). It has one source: the
// AdMob plugin's own userTrackingUsageDescription stays unset.
export type PluginEntry = string | readonly [string, unknown];
type LocaleEntry = { readonly ios?: Readonly<Record<string, unknown>> };
export type ExpoConfigLike = {
  readonly updates?: { readonly enabled?: boolean };
  readonly plugins?: readonly PluginEntry[];
  readonly ios?: {
    readonly infoPlist?: Record<string, unknown>;
    readonly onside?: { readonly enabled?: boolean };
  };
  readonly locales?: Readonly<Record<string, LocaleEntry | string>>;
  readonly extra?: { readonly game?: { readonly adPolicy?: { readonly isAdsEnabled?: boolean } } };
};

/** The app languages; each carries the tracking prompt text. */
export const ATT_LANGUAGES = ['en', 'de', 'fa', 'ckb'] as const;
const ATT_KEY = 'NSUserTrackingUsageDescription';

const nameOf = (entry: PluginEntry): string => (typeof entry === 'string' ? entry : entry[0]);

function pluginOptions(config: ExpoConfigLike, name: string): unknown {
  const entry = (config.plugins ?? []).find((plugin) => nameOf(plugin) === name);
  return typeof entry === 'string' || entry === undefined ? undefined : entry[1];
}

const hasPlugin = (config: ExpoConfigLike, name: string): boolean =>
  (config.plugins ?? []).some((plugin) => nameOf(plugin) === name);

const isText = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';

// The expo-iap plugin takes no options (iapkitApiKey, module: 'onside', modules.onside,
// ios.alternativeBilling, ...), and ios.onside.enabled must stay unset (it adds OnsideKit).
function expoIapProblems(config: ExpoConfigLike): string[] {
  const problems: string[] = [];
  if (pluginOptions(config, 'expo-iap') !== undefined) {
    problems.push('expo-iap plugin must have no options (IAPKit / Onside)');
  }
  if (config.ios?.onside?.enabled === true) problems.push('ios.onside.enabled adds OnsideKit');
  return problems;
}

/** Ads are on unless the game's extra says isAdsEnabled: false; the AdMob plugin must be listed. */
function isAdsEnabled(config: ExpoConfigLike): boolean {
  return (
    hasPlugin(config, 'react-native-google-mobile-ads') &&
    config.extra?.game?.adPolicy?.isAdsEnabled !== false
  );
}

function localeText(config: ExpoConfigLike, lang: string): unknown {
  const entry = config.locales?.[lang];
  return typeof entry === 'object' ? entry.ios?.[ATT_KEY] : undefined;
}

// O1: the tracking prompt text, once (the tracking plugin) and in every app language.
function attProblems(config: ExpoConfigLike): string[] {
  const admob = pluginOptions(config, 'react-native-google-mobile-ads');
  const problems =
    typeof admob === 'object' && admob !== null && 'userTrackingUsageDescription' in admob
      ? [
          'GMA userTrackingUsageDescription is set: the ATT text comes only from expo-tracking-transparency',
        ]
      : [];
  if (!isAdsEnabled(config)) return problems;
  const options = pluginOptions(config, 'expo-tracking-transparency');
  const permission: unknown =
    typeof options === 'object' && options !== null
      ? Reflect.get(options, 'userTrackingPermission')
      : undefined;
  if (!isText(permission)) {
    problems.push('expo-tracking-transparency plugin with userTrackingPermission is missing (ATT)');
  }
  for (const lang of ATT_LANGUAGES) {
    if (!isText(localeText(config, lang)))
      problems.push(`locales.${lang}.ios.${ATT_KEY} is missing`);
  }
  return problems;
}

export function configProblems(config: ExpoConfigLike): string[] {
  const problems = [...expoIapProblems(config), ...attProblems(config)];
  if (config.updates?.enabled !== false) problems.push('expo.updates.enabled must be false');
  const ats: unknown = config.ios?.infoPlist?.['NSAppTransportSecurity'];
  if (
    typeof ats === 'object' &&
    ats !== null &&
    Reflect.get(ats, 'NSAllowsArbitraryLoads') === true
  ) {
    problems.push('NSAllowsArbitraryLoads must not be true');
  }
  return problems;
}
