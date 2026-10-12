// packages/tooling/src/release/release-build.ts
// Release steps 3-7: clean prebuild and native audits, signed archive, export, and the
// store-artifact gate on the exported .ipa (before anything reaches Apple).
import { execFileSync } from 'node:child_process';
import { existsSync, globSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { findWorkspace, PREBUILD_ARGS, schemeOf } from '@e07/tooling/build/sim-build-plan.ts';
import { readAppExtra, readPlistValue } from '@e07/tooling/ios/sim-app.ts';
import { archiveArgs, exportArgs, xcodeAuthArgs } from '@e07/tooling/release/release-options.ts';
import { runReleaseStep } from '@e07/tooling/release/release-runner.ts';
import { ownerStepsPendingLine, storeGateProblems } from '@e07/tooling/release/store-gate.ts';

import type { ReleaseOptions } from '@e07/tooling/release/release-options.ts';
import type { Preflight } from '@e07/tooling/release/release-preflight.ts';
import type { ReleaseContext } from '@e07/tooling/release/release-runner.ts';
import type { ArtifactFacts, TRACKING_LANGUAGES } from '@e07/tooling/release/store-gate.ts';

export type BuiltIpa = { readonly ipa: string; readonly appDirInIpa: string };

/** Step 3: a clean prebuild, then the audits that read ios/Pods and ios/Podfile.lock. */
function prebuildAndAudit(options: ReleaseOptions, context: ReleaseContext): string {
  const npmRun = (script: string, extra: readonly string[]): readonly string[] => [
    ...['run', '-s', script],
    ...extra,
  ];
  runReleaseStep('prebuild', { file: 'npx', args: PREBUILD_ARGS }, context);
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
  return findWorkspace(readdirSync(join(context.appDir, 'ios')));
}

/** Steps 4-6: archive and export with API-key signing, then unpack the .ipa for the gate. */
export function buildIpa(
  options: ReleaseOptions,
  context: ReleaseContext,
  pre: Preflight,
): BuiltIpa {
  rmSync(join(context.appDir, 'build', 'export'), { recursive: true, force: true });
  const workspace = prebuildAndAudit(options, context);
  const scheme = schemeOf(workspace);
  const auth = xcodeAuthArgs(pre.keyFile, pre.ids);
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

const plistValue = (plist: string, keyPath: string): string | undefined =>
  readPlistValue(plist, keyPath, { isOptional: true });

function hasGetTaskAllow(appDir: string): boolean {
  const xml = execFileSync('codesign', ['-d', '--entitlements', '-', '--xml', appDir], {
    encoding: 'utf8',
  });
  return /<key>get-task-allow<\/key>\s*<true\s*\/>/.test(xml);
}

/** Whether a non-empty NSUserTrackingUsageDescription is in Info.plist and each language. */
function trackingTextOf(appDir: string, info: string): ArtifactFacts['trackingText'] {
  const has = (plist: string): boolean =>
    (plistValue(plist, 'NSUserTrackingUsageDescription') ?? '').trim() !== '';
  const lproj = (lang: (typeof TRACKING_LANGUAGES)[number]): boolean =>
    has(join(appDir, `${lang}.lproj`, 'InfoPlist.strings'));
  return {
    'Info.plist': has(info),
    en: lproj('en'),
    de: lproj('de'),
    fa: lproj('fa'),
    ckb: lproj('ckb'),
  };
}

const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
const fieldOf = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;

/** extra.adUnits (live builds), extra.game.links: what the placeholder checks read. */
function idsAndLinksOf(extra: Readonly<Record<string, unknown>>): Partial<ArtifactFacts> {
  const units = extra['adUnits'];
  const links = fieldOf(extra['game'], 'links');
  return {
    adUnits:
      typeof units === 'object' && units !== null
        ? Object.values(units).filter((unit): unit is string => typeof unit === 'string')
        : [],
    privacyHost: textOf(fieldOf(fieldOf(links, 'privacyPolicy'), 'host')),
    supportEmail: textOf(fieldOf(links, 'supportEmail')),
  };
}

/** Step 6: the facts the gate needs, read from the unpacked app. */
export function readArtifactFacts(appDir: string): ArtifactFacts {
  const info = join(appDir, 'Info.plist');
  const extra = readAppExtra(appDir);
  const bundle = readFileSync(join(appDir, 'main.jsbundle')).toString('latin1');
  const encryption = plistValue(info, 'ITSAppUsesNonExemptEncryption');
  return {
    adUnits: [],
    privacyHost: undefined,
    supportEmail: undefined,
    ...idsAndLinksOf(extra),
    buildNumber: plistValue(info, 'CFBundleVersion') ?? '',
    version: plistValue(info, 'CFBundleShortVersionString') ?? '',
    usesNonExemptEncryption: encryption === undefined ? undefined : encryption === 'true',
    gadAppId: plistValue(info, 'GADApplicationIdentifier'),
    extraAppVariant: textOf(extra['appVariant']),
    extraAdsMode: textOf(extra['adsMode']),
    sentinelCount: bundle.split('SHELL_TEST_BUILD_ONLY').length - 1,
    placeholderCount: bundle.split('not-built.screen').length - 1,
    testArtefacts: globSync(join(appDir, '**', '*.{storekit,xctest}')),
    hasPrivacyManifest: existsSync(join(appDir, 'PrivacyInfo.xcprivacy')),
    hasGetTaskAllow: hasGetTaskAllow(appDir),
    allowsArbitraryLoads:
      plistValue(info, 'NSAppTransportSecurity.NSAllowsArbitraryLoads') === 'true',
    bundleId: plistValue(info, 'CFBundleIdentifier'),
    trackingText: trackingTextOf(appDir, info),
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
    game: input.options.game,
  });
  if (problems.length > 0) {
    // Owner placeholders (G3, G5) end the release here by design until the owner supplies them.
    const pending = ownerStepsPendingLine(problems);
    throw new Error(
      `store-artifact gate failed for ${input.built.ipa}:\n- ${problems.join('\n- ')}${pending === null ? '' : `\n${pending}`}`,
    );
  }
  console.log('release:ios: store-artifact gate passed');
}
