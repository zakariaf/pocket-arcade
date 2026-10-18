// packages/tooling/src/audit/network-gradle-layer.test.ts
import {
  ALLOWED_ARTIFACTS,
  gradleProblems,
  networkFamilyOf,
  parseDependencyDump,
} from './network-gradle-layer.ts';

import type { Baseline } from './network-baseline.ts';

// The shape of `./gradlew :app:dependencies --configuration releaseRuntimeClasspath` (trimmed).
const DUMP = [
  '',
  '> Task :app:dependencies',
  '',
  '------------------------------------------------------------',
  "Project ':app'",
  '------------------------------------------------------------',
  '',
  'releaseRuntimeClasspath - Runtime classpath of /release.',
  '+--- com.facebook.react:react-android -> 0.86.3',
  '|    +--- androidx.appcompat:appcompat:1.7.0',
  '|    +--- com.facebook.fresco:imagepipeline-okhttp3:3.6.0',
  '|    |    \\--- com.squareup.okhttp3:okhttp:4.9.2 -> 4.12.0',
  '|    |         \\--- com.squareup.okio:okio:3.6.0',
  '|    +--- com.squareup.okhttp3:okhttp-urlconnection:4.9.2',
  '|    \\--- com.squareup.okhttp3:okhttp:4.9.2 -> 4.12.0 (*)',
  '+--- project :expo',
  '|    \\--- project :expo-file-system',
  '|         +--- com.facebook.react:react-android -> 0.86.3 (*)',
  '|         \\--- com.squareup.okhttp3:okhttp:4.9.2 -> 4.12.0 (*)',
  '+--- project :react-native-google-mobile-ads',
  '|    +--- com.google.android.gms:play-services-ads:25.4.0',
  '|    |    +--- com.google.android.gms:play-services-ads-api:25.4.0',
  '|    |    +--- com.google.android.gms:play-services-measurement-sdk-api:22.1.2',
  '|    |    \\--- androidx.work:work-runtime:2.7.0',
  '|    \\--- com.google.android.ump:user-messaging-platform:4.0.0',
  '+--- project :expo-iap',
  '|    \\--- io.github.hyochan.openiap:openiap-google:1.3.10',
  '|         \\--- com.android.billingclient:billing-ktx:9.1.0',
  '|              \\--- com.android.billingclient:billing:9.1.0',
  '\\--- androidx.core:core-ktx:{strictly 1.16.0} -> 1.16.0 (c)',
  '',
  '(c) - A dependency constraint, not a dependency.',
  '(*) - Indicates repeated occurrences of a transitive dependency subtree.',
  '',
].join('\n');

const BASELINE: Baseline = {
  'com.squareup.okhttp3:okhttp': {
    categories: ['okhttp'],
    reason:
      "React Native's and Expo's own HTTP stack, unused: our code never calls fetch (layer A)",
  },
  'com.squareup.okhttp3:okhttp-urlconnection': {
    categories: ['okhttp'],
    reason: "React Native's OkHttp URLConnection bridge, unused by our code (layer A)",
  },
  'com.facebook.fresco:imagepipeline-okhttp3': {
    categories: ['image-loader'],
    reason:
      "React Native's network image fetcher, unused: images are bundled (layer A bans remote URLs)",
  },
};

const withLine = (after: string, line: string): string => DUMP.replace(after, `${after}\n${line}`);

describe('parseDependencyDump (layer D on Android)', () => {
  it('reads every resolved artifact with its ancestors and drops constraints', () => {
    const nodes = parseDependencyDump(DUMP);
    expect(nodes).toHaveLength(21);
    expect(nodes[3]).toStrictEqual({
      id: 'com.squareup.okhttp3:okhttp',
      ancestors: ['com.facebook.react:react-android', 'com.facebook.fresco:imagepipeline-okhttp3'],
    });
    expect(nodes.find((node) => node.id === 'project :expo-file-system')).toStrictEqual({
      id: 'project :expo-file-system',
      ancestors: ['project :expo'],
    });
    expect(nodes.some((node) => node.id === 'androidx.core:core-ktx')).toBe(false);
  });

  it('returns nothing for output without a dependency tree', () => {
    expect(parseDependencyDump('BUILD SUCCESSFUL in 2s\n')).toStrictEqual([]);
  });
});

describe('networkFamilyOf', () => {
  it.each([
    ['com.squareup.okhttp3:okhttp', 'okhttp'],
    ['com.google.firebase:firebase-analytics', 'firebase'],
    ['io.sentry:sentry-android', 'crash-reporting'],
    ['com.google.android.gms:play-services-ads-lite', 'google-ads'],
    ['com.android.billingclient:billing', 'billing'],
    ['androidx.browser:browser', 'custom-tabs'],
  ])('names the network family of %s', (id, family) => {
    expect(networkFamilyOf(id)).toBe(family);
  });

  it('leaves artifacts that cannot connect unclassified', () => {
    expect(networkFamilyOf('androidx.appcompat:appcompat')).toBeNull();
    expect(networkFamilyOf('project :expo')).toBeNull();
  });
});

describe('gradleProblems', () => {
  it('passes the ads and billing artifacts, their Google dependencies and the reasoned baseline', () => {
    expect(gradleProblems(DUMP, BASELINE)).toStrictEqual([]);
  });

  it('allows exactly the ads and billing artifacts (spec N3)', () => {
    expect([...ALLOWED_ARTIFACTS].sort()).toStrictEqual([
      'com.android.billingclient:billing',
      'com.android.billingclient:billing-ktx',
      'com.google.android.gms:play-services-ads',
      'com.google.android.gms:play-services-ads-identifier',
      'com.google.android.gms:play-services-ads-lite',
      'com.google.android.ump:user-messaging-platform',
      'io.github.hyochan.openiap:openiap-google',
    ]);
  });

  it('fails a network-capable artifact outside the allowlist and the baseline', () => {
    const dump = withLine(
      '+--- project :expo-iap',
      '|    +--- com.google.firebase:firebase-analytics:22.1.2',
    );
    expect(gradleProblems(dump, BASELINE)).toStrictEqual([
      'NEW gradle com.google.firebase:firebase-analytics: firebase (not in baseline; pulled by project :expo-iap)',
    ]);
  });

  it('fails a non-Google network artifact even under an allowed one', () => {
    const dump = withLine(
      '|    |    +--- com.google.android.gms:play-services-ads-api:25.4.0',
      '|    |    +--- com.appsflyer:af-android-sdk:6.15.0',
    );
    expect(gradleProblems(dump, BASELINE)).toStrictEqual([
      'NEW gradle com.appsflyer:af-android-sdk: attribution (not in baseline; pulled by project :react-native-google-mobile-ads)',
    ]);
  });

  it('notes a baseline entry that left the build, without failing', () => {
    const baseline: Baseline = {
      ...BASELINE,
      'com.android.volley:volley': { categories: ['volley'], reason: 'an old entry that is gone' },
    };
    expect(gradleProblems(DUMP, baseline)).toStrictEqual([
      'STALE gradle com.android.volley:volley: in baseline but not found',
    ]);
  });

  it('fails a dump with no dependencies, so a broken Gradle run never passes', () => {
    expect(gradleProblems('FAILURE: Build failed with an exception.\n', BASELINE)).toStrictEqual([
      'gradle dump has no releaseRuntimeClasspath dependencies (the Gradle run failed?)',
    ]);
  });
});
