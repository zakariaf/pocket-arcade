// packages/tooling/src/audit/network-native-layer.ts
// Layer C: network-capable native code in every autolinked module, iOS (Swift, Objective-C, C)
// and Android (Kotlin, Java). Android's HTTP clients are their own category, httpClient.
import { execFile } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { addFinding } from './network-baseline.ts';

import type { Findings } from './network-baseline.ts';

const NATIVE_PATTERNS: Readonly<Record<string, RegExp>> = {
  urlSession: /\b(NS)?URLSession\b|\bNSURLConnection\b/,
  httpClient:
    /\bjava\.net\.HttpURLConnection\b|\bjavax\.net\.ssl\.HttpsURLConnection\b|\bokhttp3\b|\bCronetEngine\b|\bcom\.android\.volley\b|\bio\.ktor\.client\b/,
  webSocket:
    /URLSessionWebSocketTask|SRWebSocket|SocketRocket|\bokhttp3\.WebSocket\b|\bnewWebSocket\s*\(|\borg\.java_websocket\b/,
  lowLevelSocket:
    /\bCFSocket|\bCFStreamCreatePairWithSocket|\bNWConnection\b|\bnw_connection_|\bgetaddrinfo\(|\bjava\.net\.(?:Socket|DatagramSocket|ServerSocket)\b|\bjava\.nio\.channels\.(?:Socket|Datagram)Channel\b/,
  webView:
    /\bWKWebView\b|\bSFSafariViewController\b|\bASWebAuthenticationSession\b|\bandroid\.webkit\.WebView\b|\bandroidx\.browser\.customtabs\b/,
};
const SOURCE = /\.(swift|m|mm|h|c|cpp|kt|java)$/;

/**
 * Every native source file under dir. Symlinks are never followed: npm workspace links (an app
 * folder with its ios/Pods) and CocoaPods header links point at code scanned under its own
 * root, or at nothing at all (a dangling header link crashed the walk before).
 */
export function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const path = join(dir, name);
    const entry = lstatSync(path);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE.test(name) ? [path] : [];
  });
}

/**
 * The package folder that holds a podspec: the podspec sits at the package root or in ios/.
 * Walks up to the nearest package.json; never above the podspec's own folder when there is none
 * (taking dirname() of a root-level podspec made the whole node_modules one "module").
 */
export function packageRootOf(podspecDir: string): string {
  for (let dir = podspecDir; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    if (dirname(dir) === dir) return podspecDir;
  }
}

/**
 * Where a package is installed for this app, resolved the way Node and Metro do: npm workspaces
 * hoist react-native to the repo root, so <app>/node_modules/react-native usually does not exist.
 */
export function installedPackageRoot(appDir: string, name: string): string {
  const require = createRequire(join(appDir, 'package.json'));
  return dirname(require.resolve(`${name}/package.json`));
}

/** What the two autolinking commands print (only the fields this layer reads). */
export type AutolinkingOutput = {
  readonly rn: {
    readonly dependencies?: Readonly<
      Record<
        string,
        {
          readonly root: string;
          readonly platforms?: { readonly ios?: unknown; readonly android?: unknown };
        }
      >
    >;
  };
  readonly expo: {
    readonly modules?: readonly {
      readonly packageName: string;
      readonly pods?: readonly { readonly podspecDir: string }[];
      readonly projects?: readonly { readonly sourceDir: string }[];
    }[];
  };
};

type RnDependency = NonNullable<AutolinkingOutput['rn']['dependencies']>[string];
type ExpoModule = NonNullable<AutolinkingOutput['expo']['modules']>[number];

const hasNativePlatform = (dep: RnDependency): boolean =>
  dep.platforms?.ios !== undefined || dep.platforms?.android !== undefined;

// iOS: the podspec folder; Android: the Gradle project folder (both inside the package).
const nativeDirOf = (module: ExpoModule): string | undefined =>
  module.pods?.[0]?.podspecDir ?? module.projects?.[0]?.sourceDir;

/** name -> package root, from React Native autolinking and Expo module resolution. */
export function moduleRootsOf(
  reactNativeRoot: string,
  output: AutolinkingOutput,
): Map<string, string> {
  const roots = new Map<string, string>([['react-native', reactNativeRoot]]);
  for (const [name, dep] of Object.entries(output.rn.dependencies ?? {})) {
    if (hasNativePlatform(dep)) roots.set(name, dep.root);
  }
  for (const module of output.expo.modules ?? []) {
    const nativeDir = nativeDirOf(module);
    if (nativeDir !== undefined) roots.set(module.packageName, packageRootOf(nativeDir));
  }
  return roots;
}

const execFileAsync = promisify(execFile);

async function autolinking(appDir: string, args: readonly string[]): Promise<unknown> {
  const { stdout } = await execFileAsync('npx', ['expo-modules-autolinking', ...args], {
    cwd: appDir,
    encoding: 'utf8',
  });
  return JSON.parse(stdout) as unknown;
}

/**
 * Every native module of the app on iOS and on Android (a module may support only one). The four
 * autolinking runs are independent and run together; the roots keep the iOS-then-Android order.
 */
export async function nativeModuleRoots(appDir: string): Promise<Map<string, string>> {
  const reactNative = installedPackageRoot(appDir, 'react-native');
  const linking = (command: string, platform: string): Promise<unknown> =>
    autolinking(appDir, [command, '--platform', platform, '--json']);
  const [iosRn, iosExpo, androidRn, androidExpo] = await Promise.all([
    linking('react-native-config', 'ios'),
    linking('resolve', 'apple'),
    linking('react-native-config', 'android'),
    linking('resolve', 'android'),
  ]);
  const rootsFor = (rn: unknown, expo: unknown): Map<string, string> =>
    moduleRootsOf(reactNative, {
      rn: rn as AutolinkingOutput['rn'],
      expo: expo as AutolinkingOutput['expo'],
    });
  return new Map([...rootsFor(iosRn, iosExpo), ...rootsFor(androidRn, androidExpo)]);
}

function scanFile(path: string, owner: string, findings: Map<string, Set<string>>): void {
  const text = readFileSync(path, 'utf8');
  for (const [category, pattern] of Object.entries(NATIVE_PATTERNS)) {
    if (pattern.test(text)) addFinding(findings, owner, category);
  }
}

export function nativeNetworkFindings(roots: ReadonlyMap<string, string>): Findings {
  const findings = new Map<string, Set<string>>();
  for (const [name, root] of roots) {
    for (const file of sourceFiles(root)) scanFile(file, name, findings);
  }
  return findings;
}
