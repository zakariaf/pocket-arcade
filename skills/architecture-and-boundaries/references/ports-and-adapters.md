# The nine ports, their adapters and fakes, and injection

Every external service sits behind a port type in the Shell; only its adapter touches the vendor SDK; every port has an in-memory fake; the composition root creates each adapter once and hands the set down. Read this before adding or changing a service, an adapter or a fake, or when a screen needs a service.

## Contents

- Why ports
- The nine ports
- The signatures
- Injection: ServicesProvider and useServices
- Dependency-injection rules
- The Result type the port templates use
- Recipe: add a service or port

## Why ports

- Jest never touches native code: tests pass fakes instead of mocking modules.
- Swapping a vendor touches one file.
- Offline and failure behaviour is decided once, in the adapter (timeouts are expected failures, not exceptions).
- The ESLint vendor-SDK ban exempts exactly the adapter files, so an SDK cannot leak into a screen.

## The nine ports

| Port | File | Device adapter | Fake | Contract owner |
|---|---|---|---|---|
| `AdsPort` | `services/ads/ads-port.ts` | `admob-ads-adapter.ts` | `fake-ads.ts` | admob-ads |
| `ConsentPort` | `services/consent/consent-port.ts` | `admob-consent-adapter.ts` | `fake-consent.ts` | admob-ads |
| `PurchasePort` | `services/purchase/purchase-port.ts` | `expo-iap-purchase-adapter.ts` | `fake-purchase.ts` | premium-purchase |
| `SaveStore` (+ `SqlDriver`) | `services/save/save-store.ts`, `sql-driver.ts` | `sqlite-save-store.ts`, `expo-sqlite-sql-driver.ts` | `fake-save-store.ts`; Jest SQL: `test/integration/save/node-sqlite-sql-driver.ts` | save-persistence-and-migrations |
| `ClockPort` | `services/clock/clock-port.ts` | `system-clock-adapter.ts` | `fake-clock.ts` | this skill (port and fake, `examples/clock-port/`) / save-persistence-and-migrations (the same files, and the adapter) |
| `ConnectivityPort` | `services/connectivity/connectivity-port.ts` | `expo-network-connectivity-adapter.ts` | `fake-connectivity.ts` | admob-ads |
| `AudioPort` | `services/audio/audio-port.ts` | `audio-api-audio-adapter.ts` | `fake-audio.ts` | game-audio-and-haptics |
| `HapticsPort` | `services/haptics/haptics-port.ts` | `expo-haptics-adapter.ts` | `fake-haptics.ts` | game-audio-and-haptics |
| `ErrorLogPort` | `services/error-log/error-log-port.ts` | `sqlite-error-log-adapter.ts` | `fake-error-log.ts` | this skill (`templates/error-log-port.ts`, `templates/fake-error-log.ts`) / save-persistence-and-migrations (the same files, and the SQLite adapter) |

All paths are under `packages/shell/src/`. Adapter factories are `create` + the PascalCase file name (`createAdmobAdsAdapter`, `createSqliteSaveStore`, `createFakeClock`). The same data lives in `assets/architecture-rules.json` (`ports`), which `check-layout.mjs` reads: a `services/<port>/` folder with an adapter needs its port file and a `fake-*.ts` (`port-triple`).

## The signatures

The signatures below are the contract; the owning skill explains the behaviour behind each member.

```ts
// packages/shell/src/services/ads/ads-port.ts
import type { ReactNode } from 'react';

export type AdUnitIds = { readonly banner: string; readonly interstitial: string; readonly rewarded: string };
export type FullscreenResult = 'shown' | 'unavailable';
export type RewardResult = 'rewarded' | 'dismissed' | 'unavailable';
export type BannerSlotProps = {
  readonly onLoaded: () => void; // the slot collapses until this fires (no empty box)
  readonly onFailed: () => void; // failed loads are silent (spec 8.8)
};

/** The Shell's view of an ad SDK. Only admob-ads-adapter.ts touches the real SDK. */
export type AdsPort = {
  /** After consent: request configuration + SDK initialize. Idempotent. */
  readonly initialize: () => Promise<void>;
  readonly preloadInterstitial: () => void;
  readonly preloadRewarded: () => void;
  readonly isRewardedLoaded: () => boolean;
  /** Notifies when rewarded availability changes, so "Watch an ad" buttons appear/disappear. */
  readonly subscribeRewardedLoaded: (listener: (isLoaded: boolean) => void) => () => void;
  /** Resolve when the ad CLOSED (or immediately with 'unavailable'). Never reject. */
  readonly showInterstitial: () => Promise<FullscreenResult>;
  readonly showRewarded: () => Promise<RewardResult>;
  readonly renderBanner: (props: BannerSlotProps) => ReactNode;
};
```

```ts
// packages/shell/src/services/consent/consent-port.ts
export type ConsentInfo = {
  readonly canRequestAds: boolean;
  readonly isPrivacyOptionsRequired: boolean; // show the "Ad privacy choices" row (S11)
};

export type ConsentPort = {
  /** Every launch (not Premium, ads enabled). Offline: returns the last session's answer. */
  readonly refresh: () => Promise<ConsentInfo>;
  /** Screen S3: shows Google's form only where required. Offline: returns cached info. */
  readonly showFormIfRequired: () => Promise<ConsentInfo>;
  /** Settings > Ad privacy choices. */
  readonly showPrivacyOptions: () => Promise<ConsentInfo>;
};
```

```ts
// packages/shell/src/services/purchase/purchase-port.ts
export type StoreProduct = {
  readonly productId: string;
  readonly displayPrice: string; // store-formatted fallback
  readonly price: number | null;
  readonly currency: string;
};

/** A StoreKit 2 transaction the platform has already verified on device (JWS checked). */
export type StoreTransaction = {
  readonly productId: string;
  readonly transactionId: string;
  readonly state: 'purchased' | 'pending';
  readonly revocationDateMs: number | null; // refund / Family Sharing revocation evidence
  readonly handle: unknown; // opaque; given back to finish()
};

export type PurchaseFailure = 'cancelled' | 'deferred' | 'already-owned' | 'unavailable' | 'failed';

export type PurchaseEvent =
  | { readonly type: 'transaction'; readonly transaction: StoreTransaction }
  | { readonly type: 'failure'; readonly failure: PurchaseFailure; readonly code: string };

export type PurchasePort = {
  readonly connect: () => Promise<boolean>;
  /** null when the store returns no product (StoreKit returns [] instead of throwing). */
  readonly fetchProduct: (productId: string) => Promise<StoreProduct | null>;
  /** Resolves when the sheet was requested; the outcome arrives through subscribe(). */
  readonly requestPurchase: (productId: string) => Promise<void>;
  readonly finish: (transaction: StoreTransaction) => Promise<void>;
  /** AppStore.sync(). 'sync-failed' covers a cancelled Apple Account prompt and offline. */
  readonly restore: () => Promise<'synced' | 'sync-failed'>;
  /** Every verified transaction incl. refunded ones (Transaction.all), for evidence. */
  readonly readTransactions: () => Promise<readonly StoreTransaction[]>;
  readonly subscribe: (listener: (event: PurchaseEvent) => void) => () => void;
};
```

```ts
// packages/shell/src/services/save/save-store.ts
export type SlotName = 'current' | 'backup';

/** One row of save_slots: the whole save document as JSON plus its envelope. */
export type SlotRecord = {
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly writtenAtMs: number;
  readonly writeCount: number;
  /** FNV-1a 32 of payload, 8 hex chars. */
  readonly checksum: string;
  readonly payload: string;
};

/** Storage port for the save document. Knows rows, not documents. */
export type SaveStore = {
  readonly read: (slot: SlotName) => SlotRecord | null;
  /** Writes the given slots in ONE transaction. */
  readonly write: (slots: { readonly current?: SlotRecord; readonly backup?: SlotRecord }) => void;
  /** Copies a slot row into save_quarantine (kept for the debug export), bounded to 10 rows. */
  readonly quarantine: (slot: SlotName, reason: string, atMs: number) => void;
  /** PRAGMA wal_checkpoint(TRUNCATE): called when the app goes to the background. */
  readonly checkpoint: () => void;
};
```

```ts
// packages/shell/src/services/save/sql-driver.ts
/** Values we bind: no blobs, no booleans (store 0/1), no undefined. */
export type SqlValue = string | number | null;

/** A result row; values are unknown until a guard narrows them. */
export type SqlRow = Readonly<Record<string, unknown>>;

/**
 * The whole SQL surface of the app. Two implementations:
 * expo-sqlite-sql-driver.ts (device) and node-sqlite-sql-driver.ts (Jest, tooling).
 */
export type SqlDriver = {
  /** DDL and PRAGMAs; may contain several statements; no parameters. */
  readonly exec: (sql: string) => void;
  readonly run: (sql: string, params: readonly SqlValue[]) => void;
  /** First row or null. */
  readonly get: (sql: string, params: readonly SqlValue[]) => SqlRow | null;
  /** BEGIN; work(); COMMIT. On throw: ROLLBACK and rethrow. */
  readonly transaction: (work: () => void) => void;
};

/** What the driver factories return; the app never closes its main connection. */
export type ClosableSqlDriver = SqlDriver & { readonly close: () => void };
```

```ts
// packages/shell/src/services/clock/clock-port.ts
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

/**
 * The only source of wall-clock time in the app. Game rules never read time; screens
 * and services receive a ClockPort (test builds wrap it to "set the date", S15).
 * Adapter: system-clock-adapter.ts (the one file that reads Date). Fake: fake-clock.ts.
 */
export type ClockPort = {
  /** Epoch milliseconds: records, ad spacing, play-time deltas (clamped). Never rules. */
  readonly nowMs: () => number;
  /** Today's local calendar day 'YYYY-MM-DD'; changes at local midnight (spec S9). */
  readonly today: () => DateKey;
  /**
   * Milliseconds until the next local midnight, when today() changes: at least 1, at most
   * one local day (86,400,000; 90,000,000 on the day clocks fall back). Feeds S9's
   * "Next challenge in {h} h {m} min". A test build's set-date wrapper keeps this value.
   */
  readonly msUntilNextLocalDay: () => number;
};
```

```ts
// packages/shell/src/services/connectivity/connectivity-port.ts
export type ConnectivityPort = {
  readonly isOnline: () => boolean; // last known value; false until the first report
  readonly subscribe: (listener: (isOnline: boolean) => void) => () => void;
};
```

```ts
// packages/shell/src/services/audio/audio-port.ts
import type { SoundRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

export type SoundCategory = 'sfx' | 'ui' | 'music';

export type SoundSpec = {
  readonly category: SoundCategory;
  readonly recipe: SoundRecipe;
  /** Same sound cannot restart sooner than this (default 30 ms). */
  readonly minIntervalMs?: number;
  /** Music only: loop the buffer. */
  readonly isLoop?: boolean;
};

export type SoundBank = Readonly<Record<string, SoundSpec>>;
export type ChannelSetting = { readonly isOn: boolean; readonly volume: number };
/** From the settings store. Music defaults to OFF (spec 8.7). */
export type AudioSettings = { readonly effects: ChannelSetting; readonly music: ChannelSetting };

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  effects: { isOn: true, volume: 0.8 },
  music: { isOn: false, volume: 0.6 },
};

/** The ONLY audio API the Shell and games use. Adapter: audio-api-audio-adapter.ts. */
export type AudioPort = {
  /** Synthesises and uploads every buffer of the bank (call once at startup). */
  readonly load: (bank: SoundBank) => void;
  /** Plays a sound now or after `delayMs` (timeline cues). Silently ignores unknown ids. */
  readonly play: (soundId: string, delayMs?: number) => void;
  /** Stops sounds scheduled for the future (timeline fast-forward, pause). */
  readonly cancelPending: () => void;
  readonly applySettings: (settings: AudioSettings) => void;
  readonly startMusic: (soundId: string) => void;
  readonly stopMusic: () => void;
  readonly suspend: () => Promise<void>;
  readonly resume: () => Promise<void>;
  /** Before reloadAppAsync (direction change) and in tests. */
  readonly dispose: () => Promise<void>;
};
```

```ts
// packages/shell/src/services/haptics/haptics-port.ts
import type { HapticCue } from '@e07/game-kit/timeline/track.ts';

export type { HapticCue };

/** The ONLY haptics API the Shell and games use. Adapter: expo-haptics-adapter.ts. */
export type HapticsPort = {
  /** False on devices without a Taptic Engine: Settings hides the Vibration row. */
  readonly isSupported: boolean;
  /** Fire-and-forget. Gated by the Vibration setting and throttled; never throws. */
  readonly play: (cue: HapticCue) => void;
};
```

```ts
// packages/shell/src/services/error-log/error-log-port.ts
export type ErrorSource =
  | 'render'
  | 'frame-callback'
  | 'save'
  | 'ads'
  | 'purchase'
  | 'audio'
  | 'haptics'
  | 'unhandled-rejection'
  | 'global-handler'
  | 'boot'
  | 'i18n'
  | 'network';

export type ErrorLogEntry = {
  readonly atMs: number;
  readonly source: ErrorSource;
  readonly message: string;
};

/**
 * Spec 8.14: the local error log (never leaves the device). `record` never throws and never
 * rejects. Adapter: sqlite-error-log-adapter.ts (newest 200 rows). Fake: fake-error-log.ts.
 */
export type ErrorLogPort = {
  readonly record: (source: ErrorSource, error: unknown) => void;
  /** Newest first. */
  readonly entries: () => readonly ErrorLogEntry[];
};
```

## Injection: ServicesProvider and useServices

The composition root (game-host-integration's templates in `packages/shell/src/app/`: `createShellApp` builds `createDeviceAdapters()` once, `createShellParts` builds the services from them) builds each adapter once and passes the set down; Jest builds the same parts from `createTestAdapters()`. The complete context file is `templates/services-context.tsx`:

- `Services` lists every port the UI may use (`save` is the `SaveService` from the save skill, not the raw `SaveStore`: nothing but the save service writes the save document).
- `ServicesProvider` puts the set into React Context; `useServices()` reads it and throws a programmer error when the provider is missing.
- React Context carries dependencies only (services, theme, game module), never changing app state.

## Dependency-injection rules

- Components read ports with `useServices()`; stores and services receive ports as factory arguments (`createPremiumService({ purchase, saveStore, clock })`); pure functions receive plain values (`nowMs: number`, `seed: number`).
- Adapters and stores are created once, in the composition root (`createDeviceAdapters()` and `createShellParts`), and handed down through `ServicesProvider` and `StoresProvider`. No module-level singletons that touch native code, except inside an adapter (the AudioContext).
- Tests render with fakes through `renderWithShell`, which passes only the ports a test gives it (any other port throws on first use), so no test needs `jest.mock` for our own modules. Root `__mocks__/` exist only for vendor SDKs that crash when imported in Jest.
- No service locators, no mutable module-level registries, no importing an adapter from a screen or store.

## The Result type the port templates use

`templates/port.ts`, `vendor-port-adapter.ts` and `fake-port.ts` return expected failures as values with game-kit's shared `Result` (written by the monorepo-bootstrap skill; create it with exactly this content if it is missing):

```ts
// packages/game-kit/src/contract/result.ts

/** Outcome of an operation that can fail in an expected, recoverable way. */
export type Result<TValue, TError> =
  { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TError };

/** Wraps a success value. */
export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

/** Wraps an expected failure. `error` is a `kind`-discriminated union, never a string. */
export function err<TError>(error: TError): Result<never, TError> {
  return { ok: false, error };
}
```

Filling the port templates: `__VENDOR_CALL__` may be sync or async (the adapter awaits `Awaited<ReturnType<...>>` either way); when the value is a `boolean`, rename the adapter's `answer` parameter and the test's `SAMPLE` constant with a boolean prefix (`isConnected`, `IS_SAMPLE_ON`), because the naming rule requires one; then run Prettier on the filled files.

## Recipe: add a service or port

1. Name the port (`<Name>Port`) and write the type in `services/<port>/<port>-port.ts` with only vendor-neutral types (`templates/port.ts`). If it is one of the nine, use that exact name.
2. Write `fake-<port>.ts` first (`templates/fake-port.ts`, with `templates/fake-port.test.ts`), then the service logic (pure functions plus a small factory taking the port) test-first against the fake. `examples/clock-port/` is a complete, verified triple, and `templates/error-log-port.ts`, `templates/fake-error-log.ts` and `templates/fake-error-log.test.ts` are the error log's port and fake (both are synced from the skill library, the same files the save-persistence-and-migrations skill ships).
3. Write `<vendor>-<port>-adapter.ts` (`templates/vendor-port-adapter.ts`): the only file importing the SDK. Add its SDK to the ESLint `VENDOR_SDK_PATHS` list and to `vendorSdks` in this skill's `assets/architecture-rules.json` (a `Gate-Change:` trailer; the architecture change is the owner's call), and add a root `__mocks__/<sdk>.ts` if importing it in Jest crashes.
4. Install the SDK in every app (`npx expo install` inside each app) and add it to the Shell's `peerDependencies`; if it has a config plugin, add the entry to `shell-plugins.ts`.
5. Add the port to `Services`, create the adapter once in the composition root (a `ShellAdapters` member made in `device-adapters.ts`, its fake in `testing/create-test-adapters.ts`, both game-host-integration templates) and pass it on in `create-shell-parts.ts`; add the fake to `renderWithShell`.
6. Run `npm run audit:network` and `npm run audit:privacy` (a new native module is a new network surface), then this skill's two checkers.
