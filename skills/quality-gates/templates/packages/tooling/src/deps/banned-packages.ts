// packages/tooling/src/deps/banned-packages.ts
// Checked against package-lock.json by check-deps.ts (npm run verify) and by `npm run audit:network`.
export type BannedScope = 'anywhere' | 'direct';
export type BannedRule = {
  readonly pattern: RegExp;
  readonly scope: BannedScope;
  readonly reason: string;
};

const NO_NETWORK = 'Spec N2/N3: adds a server, telemetry or network code of its own.';

export const BANNED_PACKAGES: readonly BannedRule[] = [
  {
    pattern: /^expo-router$/,
    scope: 'anywhere',
    reason: 'The Shell owns a React Navigation 7 stack.',
  },
  { pattern: /^expo-updates$/, scope: 'anywhere', reason: 'OTA updates are network traffic.' },
  { pattern: /^expo-dev-client$/, scope: 'anywhere', reason: 'Ships a network inspector.' },
  {
    pattern: /^@react-native-community\/netinfo$/,
    scope: 'anywhere',
    reason: 'Probes Google over HTTP.',
  },
  {
    pattern: /^expo-audio$/,
    scope: 'anywhere',
    reason: 'Adds microphone and background-audio keys.',
  },
  { pattern: /^react-native-purchases(-ui)?$/, scope: 'anywhere', reason: 'RevenueCat server.' },
  { pattern: /^react-native-iap$/, scope: 'anywhere', reason: 'Second IAP stack; use expo-iap.' },
  { pattern: /^(firebase|@react-native-firebase\/.+)$/, scope: 'anywhere', reason: NO_NETWORK },
  {
    pattern: /^(@sentry\/.+|sentry-expo|@bugsnag\/.+|@datadog\/.+)$/,
    scope: 'anywhere',
    reason: NO_NETWORK,
  },
  {
    pattern: /^(expo-insights|expo-observe|expo-app-metrics)$/,
    scope: 'anywhere',
    reason: NO_NETWORK,
  },
  { pattern: /^expo-notifications$/, scope: 'anywhere', reason: 'Spec 14: no push notifications.' },
  {
    pattern: /^(@amplitude\/.+|expo-analytics-amplitude|@segment\/.+)$/,
    scope: 'anywhere',
    reason: NO_NETWORK,
  },
  {
    pattern: /^(react-native-webview|expo-web-browser)$/,
    scope: 'anywhere',
    reason: 'Web views are a network surface.',
  },
  {
    pattern: /^expo-tracking-transparency$/,
    scope: 'anywhere',
    reason: 'Decision D4: no ATT prompt in v1.',
  },
  {
    pattern: /^react-native-restart$/,
    scope: 'anywhere',
    reason: 'reloadAppAsync from expo covers restarts.',
  },
  {
    pattern: /^eslint-plugin-react-compiler$/,
    scope: 'anywhere',
    reason: 'Superseded by react-hooks 7.',
  },
  {
    pattern: /^(axios|ky|got|node-fetch|cross-fetch)$/,
    scope: 'direct',
    reason: 'Spec N3: no HTTP client.',
  },
];

type LockEntry = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
};
export type Lockfile = { readonly packages: Readonly<Record<string, LockEntry>> };
export type PackageInventory = {
  readonly direct: readonly string[];
  readonly all: readonly string[];
};
export type BannedHit = { readonly name: string; readonly reason: string };

const NODE_MODULES = 'node_modules/';

/** Direct dependencies of every workspace, and every installed package, from package-lock.json. */
export function inventoryFromLockfile(lockfile: Lockfile): PackageInventory {
  const paths = Object.keys(lockfile.packages);
  const all = paths
    .filter((path) => path.includes(NODE_MODULES))
    .map((path) => path.slice(path.lastIndexOf(NODE_MODULES) + NODE_MODULES.length));
  const direct = paths
    .filter((path) => !path.includes(NODE_MODULES))
    .flatMap((path) => {
      const entry = lockfile.packages[path];
      return Object.keys({
        ...entry?.dependencies,
        ...entry?.devDependencies,
        ...entry?.optionalDependencies,
      });
    });
  return { direct: [...new Set(direct)].sort(), all: [...new Set(all)].sort() };
}

/** Every banned package in the inventory; HTTP clients count only as direct dependencies. */
export function findBannedPackages(inventory: PackageInventory): readonly BannedHit[] {
  return BANNED_PACKAGES.flatMap((rule) => {
    const names = rule.scope === 'direct' ? inventory.direct : inventory.all;
    return names
      .filter((name) => rule.pattern.test(name))
      .map((name) => ({ name, reason: rule.reason }));
  });
}
