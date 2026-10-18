// packages/tooling/src/audit/network-gradle-layer.ts
// Layer D on Android: the Maven artifacts in the release build, read from
// `./gradlew :app:dependencies --configuration releaseRuntimeClasspath` (the Android twin of the
// CocoaPods trunk pods). Spec N3: only the ads (AdMob, UMP) and billing (Play Billing through
// expo-iap's openiap-google) artifacts may go online, plus the Google libraries they pull in.
// Any other network-capable artifact fails unless the Gradle baseline names it with a reason
// (React Native's own OkHttp stack, unused because our code never calls fetch: layer A).
import type { Baseline } from './network-baseline.ts';

export type GradleNode = { readonly id: string; readonly ancestors: readonly string[] };

/** The only network-capable artifacts the app may ship (spec N3 (a) ads, (b) store purchases). */
export const ALLOWED_ARTIFACTS: ReadonlySet<string> = new Set([
  'com.google.android.gms:play-services-ads', // react-native-google-mobile-ads
  'com.google.android.gms:play-services-ads-lite', // the same SDK's lite part
  'com.google.android.gms:play-services-ads-identifier', // the advertising ID (AdMob, ATT plugin)
  'com.google.android.ump:user-messaging-platform', // Google's consent form (UMP)
  'com.android.billingclient:billing', // Google Play Billing
  'com.android.billingclient:billing-ktx',
  'io.github.hyochan.openiap:openiap-google', // expo-iap's Play Billing core
]);

// group:name patterns of artifacts that can open a connection, by family.
const NETWORK_FAMILIES: readonly (readonly [RegExp, string])[] = [
  [/^com\.squareup\.okhttp3?:/, 'okhttp'],
  [/^com\.squareup\.retrofit2?:/, 'retrofit'],
  [/^com\.android\.volley:/, 'volley'],
  [/^org\.chromium\.net:|^com\.google\.android\.gms:play-services-cronet$/, 'cronet'],
  [/^io\.ktor:ktor-client/, 'ktor'],
  [/^io\.grpc:/, 'grpc'],
  [/^com\.apollographql\./, 'graphql'],
  [/^org\.java-websocket:/, 'websocket'],
  [/^com\.google\.firebase:/, 'firebase'],
  [/^com\.google\.android\.gms:play-services-ads/, 'google-ads'],
  [/^com\.google\.android\.gms:play-services-(measurement|analytics)/, 'google-measurement'],
  [/^com\.google\.android\.ump:/, 'consent'],
  [/^com\.google\.ads\.mediation:/, 'ad-mediation'],
  [/^com\.android\.billingclient:/, 'billing'],
  [/^io\.github\.hyochan\.openiap:/, 'billing'],
  [/^com\.facebook\.android:/, 'facebook'],
  [/^(io\.sentry|com\.bugsnag|com\.datadoghq|com\.instabug\.library):/, 'crash-reporting'],
  [/^(com\.appsflyer|com\.adjust\.sdk|io\.branch\.sdk\.android|com\.kochava)/, 'attribution'],
  [/^(com\.amplitude|com\.mixpanel\.android|com\.segment\.analytics)/, 'analytics'],
  [/^com\.onesignal:/, 'push'],
  [/^(com\.github\.bumptech\.glide|com\.squareup\.picasso|io\.coil-kt)/, 'image-loader'],
  [/^com\.facebook\.fresco:imagepipeline-okhttp/, 'image-loader'],
  [/^androidx\.browser:/, 'custom-tabs'],
  [/^androidx\.webkit:/, 'webview'],
];

/** The network family of a `group:name` id, or null for an artifact that cannot connect. */
export function networkFamilyOf(id: string): string | null {
  return NETWORK_FAMILIES.find(([pattern]) => pattern.test(id))?.[1] ?? null;
}

const TREE_LINE = /^((?:[|\s] {4})*)[+\\]--- (.+)$/;

/** `group:name:version -> v (*)` or `project :name` -> the id without versions or markers. */
function idOf(text: string): string | null {
  if (/\((c|n)\)$/.test(text)) return null; // a constraint or an unresolved entry, not a dependency
  const [first = '', second = ''] = text.split(' ');
  if (first === 'project') return `project ${second}`;
  const [group, name] = first.split(':');
  return group === undefined || name === undefined ? null : `${group}:${name}`;
}

/** Every resolved dependency of the dump, with the chain of dependencies above it. */
export function parseDependencyDump(dump: string): GradleNode[] {
  const nodes: GradleNode[] = [];
  const stack: string[] = [];
  for (const line of dump.split('\n')) {
    const match = TREE_LINE.exec(line);
    if (match === null) continue;
    const depth = (match[1] ?? '').length / 5;
    const id = idOf((match[2] ?? '').trim());
    if (id === null) continue;
    stack.length = depth;
    nodes.push({ id, ancestors: [...stack] });
    stack.push(id);
  }
  return nodes;
}

const GOOGLE_GROUP = /^(com\.google\.|androidx\.)/;

/** Allowed, or a Google library that one of its paths reaches through an allowed artifact. */
function isAllowed(id: string, occurrences: readonly GradleNode[]): boolean {
  if (ALLOWED_ARTIFACTS.has(id)) return true;
  return (
    GOOGLE_GROUP.test(id) &&
    occurrences.some((node) => node.ancestors.some((above) => ALLOWED_ARTIFACTS.has(above)))
  );
}

/** Who brings an artifact in: the top-level dependency of each of its paths. */
function pulledBy(occurrences: readonly GradleNode[]): string {
  return [...new Set(occurrences.map((node) => node.ancestors[0] ?? node.id))].join(', ');
}

/** The NEW line of one artifact, or null when it cannot connect, is allowed or is baselined. */
function newArtifactLine(
  id: string,
  occurrences: readonly GradleNode[],
  baseline: Baseline,
): string | null {
  const family = networkFamilyOf(id);
  if (family === null || isAllowed(id, occurrences)) return null;
  if (baseline[id]?.categories.includes(family) === true) return null;
  return `NEW gradle ${id}: ${family} (not in baseline; pulled by ${pulledBy(occurrences)})`;
}

/** NEW lines fail; STALE lines (a baseline entry no longer in the build) are notes. */
export function gradleProblems(dump: string, baseline: Baseline): string[] {
  const nodes = parseDependencyDump(dump);
  if (nodes.length === 0) {
    return ['gradle dump has no releaseRuntimeClasspath dependencies (the Gradle run failed?)'];
  }
  const byId = new Map<string, GradleNode[]>();
  for (const node of nodes) byId.set(node.id, [...(byId.get(node.id) ?? []), node]);
  const fresh = [...byId]
    .map(([id, occurrences]) => newArtifactLine(id, occurrences, baseline))
    .filter((line): line is string => line !== null);
  const stale = Object.keys(baseline)
    .filter((id) => !byId.has(id))
    .map((id) => `STALE gradle ${id}: in baseline but not found`);
  return [...fresh, ...stale];
}
