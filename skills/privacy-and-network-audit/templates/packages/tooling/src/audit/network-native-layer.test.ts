// packages/tooling/src/audit/network-native-layer.test.ts
// Builds a small npm-workspaces repo on disk, shaped like the ones that crashed the layer: a native
// package hoisted to the root (not in apps/<game>/node_modules), an Expo module whose podspec sits
// at its package root, and a workspace link back into the app with a dangling CocoaPods header link.
// The hoisted package is called hoisted-native: Jest's own resolver maps react-native itself.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  installedPackageRoot,
  moduleRootsOf,
  nativeNetworkFindings,
  packageRootOf,
  sourceFiles,
} from './network-native-layer.ts';

let repo = '';
const at = (...parts: readonly string[]): string => join(repo, ...parts);

function write(rel: string, content: string): void {
  mkdirSync(dirname(at(rel)), { recursive: true });
  writeFileSync(at(rel), content);
}

function link(target: string, rel: string): void {
  mkdirSync(dirname(at(rel)), { recursive: true });
  symlinkSync(target, at(rel));
}

function makeRepo(): void {
  // realpath: macOS's tmpdir sits behind the /var -> /private/var link, and resolve() answers
  // with real paths.
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'native-layer-')));
  write('package.json', '{ "name": "repo", "workspaces": ["apps/*"] }');
  write('apps/game/package.json', '{ "name": "@e07/game" }');
  write('apps/game/ios/Pods/Headers/Public/Game.h', '// generated');
  write('node_modules/hoisted-native/package.json', '{ "name": "hoisted-native" }');
  write('node_modules/hoisted-native/React/Base/RCTNet.m', '[NSURLSession sharedSession];');
  // An Expo module whose podspec sits at the package root (podspecDir = the package folder).
  write('node_modules/root-pod/package.json', '{ "name": "root-pod" }');
  write('node_modules/root-pod/RootPod.podspec', 'Pod::Spec.new');
  write('node_modules/root-pod/ios/RootPod.swift', 'let web = WKWebView()');
  // A package next to it that is not a native module of this app.
  write('node_modules/other/package.json', '{ "name": "other" }');
  write('node_modules/other/ios/Other.m', 'NWConnection *c;');
  link(join('..', '..', 'apps', 'game'), 'node_modules/@e07/game');
  link(join(repo, 'does-not-exist.h'), 'apps/game/ios/Pods/Headers/Public/Dangling.h');
}

describe('native modules (layer C)', () => {
  beforeEach(makeRepo);
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('finds a package where npm hoisted it, not in the app folder', () => {
    expect(installedPackageRoot(at('apps/game'), 'hoisted-native')).toBe(
      at('node_modules/hoisted-native'),
    );
  });

  it('takes a root-level podspec folder as the package root, never its parent', () => {
    expect(packageRootOf(at('node_modules/root-pod'))).toBe(at('node_modules/root-pod'));
    expect(packageRootOf(at('node_modules/root-pod/ios'))).toBe(at('node_modules/root-pod'));
  });

  it('stays at the podspec folder when no package.json is above it', () => {
    const lonely = realpathSync(mkdtempSync(join(tmpdir(), 'native-layer-lonely-')));
    try {
      expect(packageRootOf(lonely)).toBe(lonely);
    } finally {
      rmSync(lonely, { recursive: true, force: true });
    }
  });

  it('attributes each finding to its own module only', () => {
    const roots = moduleRootsOf(at('node_modules/hoisted-native'), {
      rn: {},
      expo: {
        modules: [{ packageName: 'root-pod', pods: [{ podspecDir: at('node_modules/root-pod') }] }],
      },
    });
    expect(roots).toStrictEqual(
      new Map([
        ['react-native', at('node_modules/hoisted-native')],
        ['root-pod', at('node_modules/root-pod')],
      ]),
    );
    const findings = nativeNetworkFindings(roots);
    expect(findings).toStrictEqual(
      new Map([
        ['react-native', new Set(['urlSession'])],
        ['root-pod', new Set(['webView'])],
      ]),
    );
  });

  it('keeps React Native autolinking roots that support iOS', () => {
    const roots = moduleRootsOf(at('node_modules/hoisted-native'), {
      rn: {
        dependencies: {
          other: { root: at('node_modules/other'), platforms: { ios: {} } },
          'android-only': { root: at('node_modules/android-only'), platforms: {} },
        },
      },
      expo: {},
    });
    expect([...roots.keys()]).toStrictEqual(['react-native', 'other']);
  });

  it('skips every symlink, so a workspace link or a dangling header cannot crash the walk', () => {
    expect(sourceFiles(at('node_modules/@e07'))).toStrictEqual([]);
    expect(sourceFiles(at('apps/game'))).toStrictEqual([
      at('apps/game/ios/Pods/Headers/Public/Game.h'),
    ]);
  });
});
