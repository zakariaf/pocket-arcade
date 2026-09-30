// packages/tooling/src/release/release-build.ts
// Release steps 3-7: clean prebuild and native audits, signed archive, export, and the
// store-artifact gate on the exported .ipa (before anything reaches Apple).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, globSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { archiveArgs, exportArgs, xcodeAuthArgs } from '@e07/tooling/release/release-options.ts';
import { runReleaseStep } from '@e07/tooling/release/release-runner.ts';
import { storeGateProblems } from '@e07/tooling/release/store-gate.ts';

import type { ReleaseOptions } from '@e07/tooling/release/release-options.ts';
import type { Preflight } from '@e07/tooling/release/release-preflight.ts';
import type { ReleaseContext } from '@e07/tooling/release/release-runner.ts';
import type { ArtifactFacts } from '@e07/tooling/release/store-gate.ts';

export type BuiltIpa = { readonly ipa: string; readonly appDirInIpa: string };

function schemeOf(appDir: string): string {
  const workspace = readdirSync(join(appDir, 'ios')).find((entry) =>
    entry.endsWith('.xcworkspace'),
  );
  if (workspace === undefined) {
    throw new Error('prebuild wrote no .xcworkspace: read build/logs/prebuild.log');
  }
  return workspace.slice(0, -'.xcworkspace'.length);
}

/** Step 3: a clean prebuild, then the audits that read ios/Pods and ios/Podfile.lock. */
function prebuildAndAudit(options: ReleaseOptions, context: ReleaseContext): string {
  const npmRun = (script: string, extra: readonly string[]): readonly string[] => [
    ...['run', '-s', script],
    ...extra,
  ];
  runReleaseStep(
    'prebuild',
    { file: 'npx', args: ['expo', 'prebuild', '--platform', 'ios', '--clean'] },
    context,
  );
  runReleaseStep(
    'audit-privacy',
    { file: 'npm', args: npmRun('audit:privacy', ['--', '--app', options.game]), atRoot: true },
    context,
  );
  runReleaseStep(
    'audit-network',
    { file: 'npm', args: npmRun('audit:network', []), atRoot: true },
    context,
  );
  return schemeOf(context.appDir);
}

/** Steps 4-6: archive and export with API-key signing, then unpack the .ipa for the gate. */
export function buildIpa(
  options: ReleaseOptions,
  context: ReleaseContext,
  pre: Preflight,
): BuiltIpa {
  rmSync(join(context.appDir, 'build', 'export'), { recursive: true, force: true });
  const scheme = prebuildAndAudit(options, context);
  const auth = xcodeAuthArgs(pre.keyFile, pre.ids);
  const workspace = join('ios', `${scheme}.xcworkspace`);
  runReleaseStep(
    'archive',
    { file: 'xcodebuild', args: archiveArgs({ workspace, scheme }, auth) },
    context,
  );
  runReleaseStep(
    'export',
    { file: 'xcodebuild', args: exportArgs(scheme, options.variant, auth) },
    context,
  );
  const ipa = globSync(join(context.appDir, 'build', 'export', '*.ipa'))[0];
  if (ipa === undefined) {
    throw new Error('export produced no .ipa: read build/logs/export.log');
  }
  const unpacked = join(context.appDir, 'build', 'ipa-check');
  rmSync(unpacked, { recursive: true, force: true });
  execFileSync('unzip', ['-q', ipa, '-d', unpacked]);
  return { ipa, appDirInIpa: globSync(join(unpacked, 'Payload', '*.app'))[0] ?? '' };
}

function plistValue(plist: string, keyPath: string): string | undefined {
  const result = spawnSync('plutil', ['-extract', keyPath, 'raw', '-o', '-', plist], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function hasGetTaskAllow(appDir: string): boolean {
  const xml = execFileSync('codesign', ['-d', '--entitlements', '-', '--xml', appDir], {
    encoding: 'utf8',
  });
  return /<key>get-task-allow<\/key>\s*<true\s*\/>/.test(xml);
}

function readExtra(appDir: string): Readonly<Record<string, unknown>> {
  const constants = join(appDir, 'EXConstants.bundle', 'app.config');
  const parsed = JSON.parse(readFileSync(constants, 'utf8')) as { extra?: Record<string, unknown> };
  return parsed.extra ?? {};
}

/** Step 6: the facts the gate needs, read from the unpacked app. */
export function readArtifactFacts(appDir: string): ArtifactFacts {
  const info = join(appDir, 'Info.plist');
  const extra = readExtra(appDir);
  const bundle = readFileSync(join(appDir, 'main.jsbundle')).toString('latin1');
  const encryption = plistValue(info, 'ITSAppUsesNonExemptEncryption');
  const text = (value: unknown): string | undefined =>
    typeof value === 'string' ? value : undefined;
  return {
    buildNumber: plistValue(info, 'CFBundleVersion') ?? '',
    version: plistValue(info, 'CFBundleShortVersionString') ?? '',
    usesNonExemptEncryption: encryption === undefined ? undefined : encryption === 'true',
    gadAppId: plistValue(info, 'GADApplicationIdentifier'),
    extraAppVariant: text(extra['appVariant']),
    extraAdsMode: text(extra['adsMode']),
    sentinelCount: bundle.split('SHELL_TEST_BUILD_ONLY').length - 1,
    placeholderCount: bundle.split('not-built.screen').length - 1,
    testArtefacts: globSync(join(appDir, '**', '*.{storekit,xctest}')),
    hasPrivacyManifest: existsSync(join(appDir, 'PrivacyInfo.xcprivacy')),
    hasGetTaskAllow: hasGetTaskAllow(appDir),
    allowsArbitraryLoads:
      plistValue(info, 'NSAppTransportSecurity.NSAllowsArbitraryLoads') === 'true',
  };
}

export type GateInput = {
  readonly built: BuiltIpa;
  readonly options: ReleaseOptions;
  readonly buildNumber: number;
  readonly version: string;
};

/** Step 7: the store-artifact gate. Any problem stops the release before --validate-app. */
export function runStoreGate(input: GateInput): void {
  const facts = readArtifactFacts(input.built.appDirInIpa);
  const problems = storeGateProblems(facts, {
    variant: input.options.variant,
    buildNumber: input.buildNumber,
    version: input.version,
  });
  if (problems.length > 0) {
    throw new Error(
      `store-artifact gate failed for ${input.built.ipa}:\n- ${problems.join('\n- ')}`,
    );
  }
  console.log('release:ios: store-artifact gate passed');
}
