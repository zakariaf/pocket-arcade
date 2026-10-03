// packages/tooling/src/audit/network-pods-layer.test.ts
import { externalSources, podProblems, trunkPods } from './network-pods-layer.ts';

const LOCK = [
  'PODS:',
  '  - Google-Mobile-Ads-SDK (13.6.0)',
  '',
  'SPEC REPOS:',
  '  trunk:',
  '    - Google-Mobile-Ads-SDK',
  '    - GoogleUserMessagingPlatform',
  '    - openiap',
  '',
  'EXTERNAL SOURCES:',
  '  ExpoModulesCore:',
  '    :path: "../node_modules/expo-modules-core"',
  '',
].join('\n');

describe('vendor pods (layer D)', () => {
  it('reads the trunk pods of a Podfile.lock', () => {
    expect(trunkPods(LOCK)).toStrictEqual([
      'Google-Mobile-Ads-SDK',
      'GoogleUserMessagingPlatform',
      'openiap',
    ]);
    expect(podProblems(LOCK)).toStrictEqual([]);
  });

  it('fails on any trunk pod outside the allowlist', () => {
    const withOnside = LOCK.replace('    - openiap', '    - OnsideKit\n    - openiap');
    expect(podProblems(withOnside)).toStrictEqual([
      'vendor pod OnsideKit is not on the N3 allowlist',
    ]);
  });
});

describe('pods outside the trunk (EXTERNAL SOURCES, layer D)', () => {
  const external = (lines: readonly string[]): string =>
    LOCK.replace(
      '  ExpoModulesCore:\n    :path: "../node_modules/expo-modules-core"\n',
      `${lines.join('\n')}\n`,
    );

  it('reads each external pod with its source keys', () => {
    const lock = external([
      '  hermes-engine:',
      '    :podspec: "../../../node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec"',
      '    :tag: hermes-v250829098.0.17',
      '  ReactCodegen:',
      '    :path: build/generated/ios/ReactCodegen',
    ]);
    expect(externalSources(lock)).toStrictEqual(
      new Map([
        [
          'hermes-engine',
          {
            podspec: '../../../node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec',
            tag: 'hermes-v250829098.0.17',
          },
        ],
        ['ReactCodegen', { path: 'build/generated/ios/ReactCodegen' }],
      ]),
    );
  });

  it('fails a :git pod and passes a :path pod built from node_modules', () => {
    const lock = external([
      '  LocalKit:',
      '    :path: "../../../node_modules/local-kit/ios"',
      '  RemoteKit:',
      '    :git: https://github.com/example/remote-kit.git',
      '    :tag: 1.0.0',
    ]);
    expect(podProblems(lock)).toStrictEqual([
      'pod RemoteKit comes from a :git source (https://github.com/example/remote-kit.git), not the CocoaPods trunk or a folder in the repo',
    ]);
  });

  it('fails a remote :podspec, an :http pod and a :path outside the repo', () => {
    const lock = external([
      '  Codegen:',
      '    :path: build/generated/ios/ReactCodegen',
      '  Fmt:',
      '    :podspec: "../../../node_modules/react-native/third-party-podspecs/fmt.podspec"',
      '  Outside:',
      '    :path: "../../../../other-repo/ios"',
      '  Tarball:',
      '    :http: https://example.com/kit.zip',
      '  WebSpec:',
      '    :podspec: https://example.com/WebSpec.podspec',
    ]);
    expect(podProblems(lock)).toStrictEqual([
      'pod Outside comes from a :path source (../../../../other-repo/ios), not the CocoaPods trunk or a folder in the repo',
      'pod Tarball comes from a :http source (https://example.com/kit.zip), not the CocoaPods trunk or a folder in the repo',
      'pod WebSpec comes from a :podspec source (https://example.com/WebSpec.podspec), not the CocoaPods trunk or a folder in the repo',
    ]);
  });

  it('lets an allowlisted vendor pod come from any source', () => {
    const lock = external(['  openiap:', '    :git: https://github.com/hyochan/openiap.git']);
    expect(podProblems(lock)).toStrictEqual([]);
  });
});
