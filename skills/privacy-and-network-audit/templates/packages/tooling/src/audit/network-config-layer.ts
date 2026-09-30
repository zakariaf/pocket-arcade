// packages/tooling/src/audit/network-config-layer.ts
// Layer E: configuration that would add network paths. Input: `expo config --json --type prebuild`
// of a STORE build. Banned npm packages are checked by banned-packages.ts in the same run.
export type PluginEntry = string | readonly [string, unknown];
export type ExpoConfigLike = {
  readonly updates?: { readonly enabled?: boolean };
  readonly plugins?: readonly PluginEntry[];
  readonly ios?: {
    readonly infoPlist?: Record<string, unknown>;
    readonly onside?: { readonly enabled?: boolean };
  };
};

function pluginOptions(config: ExpoConfigLike, name: string): unknown {
  const entry = (config.plugins ?? []).find((p) => (typeof p === 'string' ? p : p[0]) === name);
  return typeof entry === 'string' || entry === undefined ? undefined : entry[1];
}

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

function admobProblems(config: ExpoConfigLike): string[] {
  const options = pluginOptions(config, 'react-native-google-mobile-ads');
  const hasAtt =
    typeof options === 'object' && options !== null && 'userTrackingUsageDescription' in options;
  return hasAtt ? ['GMA userTrackingUsageDescription is set but D4 = no ATT in v1'] : [];
}

export function configProblems(config: ExpoConfigLike): string[] {
  const problems = [...expoIapProblems(config), ...admobProblems(config)];
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
