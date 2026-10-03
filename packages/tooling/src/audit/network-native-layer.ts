// packages/tooling/src/audit/network-native-layer.ts
// Layer C: network-capable native code in every autolinked iOS module.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { addFinding } from './network-baseline.ts';

import type { Findings } from './network-baseline.ts';

const NATIVE_PATTERNS: Readonly<Record<string, RegExp>> = {
  urlSession: /\b(NS)?URLSession\b|\bNSURLConnection\b/,
  webSocket: /URLSessionWebSocketTask|SRWebSocket|SocketRocket/,
  lowLevelSocket:
    /\bCFSocket|\bCFStreamCreatePairWithSocket|\bNWConnection\b|\bnw_connection_|\bgetaddrinfo\(/,
  webView: /\bWKWebView\b|\bSFSafariViewController\b|\bASWebAuthenticationSession\b/,
};
const SOURCE = /\.(swift|m|mm|h|c|cpp)$/;

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
      Record<string, { readonly root: string; readonly platforms?: { readonly ios?: unknown } }>
    >;
  };
  readonly expo: {
    readonly modules?: readonly {
      readonly packageName: string;
      readonly pods?: readonly { readonly podspecDir: string }[];
    }[];
  };
};

/** name -> package root, from React Native autolinking and Expo module resolution. */
export function moduleRootsOf(
  reactNativeRoot: string,
  output: AutolinkingOutput,
): Map<string, string> {
  const roots = new Map<string, string>([['react-native', reactNativeRoot]]);
  for (const [name, dep] of Object.entries(output.rn.dependencies ?? {})) {
    if (dep.platforms?.ios !== undefined) roots.set(name, dep.root);
  }
  for (const module of output.expo.modules ?? []) {
    const podspecDir = module.pods?.[0]?.podspecDir;
    if (podspecDir !== undefined) roots.set(module.packageName, packageRootOf(podspecDir));
  }
  return roots;
}

function autolinking(appDir: string, args: readonly string[]): unknown {
  const json = execFileSync('npx', ['expo-modules-autolinking', ...args], {
    cwd: appDir,
    encoding: 'utf8',
  });
  return JSON.parse(json) as unknown;
}

export function nativeModuleRoots(appDir: string): Map<string, string> {
  return moduleRootsOf(installedPackageRoot(appDir, 'react-native'), {
    rn: autolinking(appDir, [
      'react-native-config',
      '--platform',
      'ios',
      '--json',
    ]) as AutolinkingOutput['rn'],
    expo: autolinking(appDir, [
      'resolve',
      '--platform',
      'apple',
      '--json',
    ]) as AutolinkingOutput['expo'],
  });
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
