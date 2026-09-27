# 06 · Navigation, state and persistence

> **What this doc decides.** One React Navigation 7 static native stack for screens S2–S15 (first-run, main and test-only debug groups; Back on the Game screen opens Pause; direction from `I18nManager`). App state lives in four thin Zustand stores over pure reducers; a game run lives in a pure `GameSession` reducer. Everything the player owns is one versioned JSON save document, validated with **valibot 1.5.0**, written synchronously to SQLite (WAL, `synchronous = FULL`) after every move and every settings change, with a backup slot, frozen-fixture migrations, a crash-tested load path, and a boot sequence that never writes before the direction check.
> **Binding source:** [99-final-decisions.md](99-final-decisions.md) A.4, A.5, A.6, B.12–B.13, C.31, D.38–D.41, F. Problems found while writing are listed under [Open issues](#open-issues).
> **Related docs:** [02-architecture-and-folders.md](02-architecture-and-folders.md) (ports and the game contract), [05-components-hooks-styling.md](05-components-hooks-styling.md) (components that read stores), [10-i18n-and-rtl.md](10-i18n-and-rtl.md) (direction check and startShell), [12-in-app-purchase.md](12-in-app-purchase.md) (the Premium section), [08-game-engine.md](08-game-engine.md) (board host and lifecycle), [07-testing-and-tdd.md](07-testing-and-tdd.md) (save tests and E2E), [15-performance-and-accessibility.md](15-performance-and-accessibility.md) (save-write budget). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

---

## 1. Introduction

Three kinds of state exist in the app, and each has one home:

| State | Lives in | Persisted | Example |
|---|---|---|---|
| Navigation | React Navigation's state (one native stack) | no (rebuilt at launch; a run in progress is reopened from the save) | "Settings is on top of Home" |
| App state | four Zustand stores: settings, progress, stats, premium | yes, as sections of the save document | theme, stars, streak, Premium |
| A run (one level, daily, endless or tutorial) | a per-session vanilla Zustand store holding a `GameSession` | yes, as the save document's `run` section | board state, undo history, move count |

The **save document** is the single source of truth for everything persisted. Stores are hydrated from it once at startup and write back through one `SaveService`; nothing else touches SQLite.

This doc owns the navigator, the stores' shape and pattern, the `GameSession` reducer, the save document, its SQL, migrations and tests, the boot-time hydration, and the daily-challenge and statistics data models. The layout direction switch is docs/10's, ads state docs/11's, Premium flows docs/12's, the board host docs/08's, and components docs/05's.

---

## 2. Rules

### Navigation

1. **Define exactly one navigator: the static native stack in `packages/shell/src/navigation/root-stack.tsx`.** No Expo Router, no tabs, no nested navigators, no second stack.
   *Why:* FINAL A.4; about 15 screens at most 2 levels deep fit one stack, and the Shell must own navigation. **Source:** [React Navigation static configuration](https://reactnavigation.org/docs/static-configuration).
2. **Only S2, S5, S8–S13 (with S11a–d and the S13 tutorial level) and S15 are routes.** S1 is the native splash plus synchronous hydration, S3 is Google's consent form (docs/11), S6 Pause and S7 Result are overlays inside the Game screen, S14 dialogs render above the navigator.
   *Why:* the overlays must keep the board mounted and paused; a route change would unmount it.
3. **Type every route through the static config:** params come from `StaticScreenProps<…>` on the screen component, and `navigation/react-navigation.d.ts` registers `StaticParamList<typeof rootStack>` globally. Params stay small and serialisable.
   *Why:* `navigate('Game', …)` with a wrong name or param fails `tsc` (verified).
4. **Show screens by group:** `FirstRun` while the tutorial is not done, `Main` after it, `Debug` only when `TEST_ONLY !== null` (docs/14). Groups switch by their `if` hooks, never by `navigate`.
   *Why:* conditional groups are how the static API expresses flows; the debug screen's code must be absent from store bundles (verified by bundle grep).
5. **On the Game screen: `gestureEnabled: false` plus `usePreventRemove` while a run is playing or paused.** Back while playing opens Pause; Back in Pause resumes; leaving is only the Pause "Home" button, which dispatches the intercepted or a `popTo` action.
   *Why:* spec S5/S6 ("a stray swipe never loses a run"). **Source:** [usePreventRemove](https://reactnavigation.org/docs/use-prevent-remove). The save after every move is the real guarantee: `usePreventRemove` cannot see app kills.
6. **Pass `direction={readLayoutDirection()}` to the navigation container**, the same `I18nManager` source as the layout (docs/10), never the language setting.
   *Why:* during the one launch before a direction reload the language already says RTL while the layout is still LTR; both must agree.
7. **Go back to an existing screen with `popTo`, never `navigate`.**
   *Why:* in React Navigation 7 `navigate` no longer goes back; it pushes. **Source:** [Upgrading from 6.x](https://reactnavigation.org/docs/upgrading-from-6.x).

### State

8. **One Zustand store per domain (settings, progress, stats, premium), each created by a factory from the loaded save document and provided through `StoresProvider`.** No module-level store singletons.
   *Why:* FINAL A.5; tests create fresh stores per test with a fake save store.
9. **Put all logic in pure reducers `<domain>Reducer(state, action)` with imperative kebab-case action types; a store only reduces, persists through `SaveService.update`, then publishes.**
   *Why:* reducers are unit-tested without React; persisting before publishing means the screen never shows a value that is not on disk.
10. **Selectors return a primitive or a reference that already lives in the state. A selector that builds an object or array is wrapped in `useShallow`.**
    *Why:* in Zustand 5 a selector returning a new object every call causes "Maximum update depth exceeded". **Source:** [Zustand v5 migration](https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md).
11. **A run is a `GameSession` changed only by the pure `gameSessionReducer`; the new session is saved before its events are animated.**
    *Why:* FINAL B.12; a kill during an animation loses nothing.

### Persistence

12. **Persist everything the player owns in one JSON document** in `save_slots('current'|'backup')`, through `SaveService` only.
    *Why:* FINAL A.6; one document gives one version number and pure migrations.
13. **Validate the document with the valibot schema on every load and before every write.** An invalid document is never written; in test builds it throws.
    *Why:* spec N10 ("losing a player's progress is the worst bug"); a bug must fail loudly in tests and never reach disk.
14. **Open SQLite with `journal_mode = WAL` and `synchronous = FULL`, write every change in one transaction, and refresh `backup` from a validated `current` at startup, at every run end, after a reset and after a Premium change (never per move).**
    *Why:* a committed transaction survives a kill or power loss; the backup covers bit rot and bugs. **Source:** [SQLite WAL](https://www.sqlite.org/wal.html), [PRAGMA synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous).
15. **Change the document only through a new schema version, a pure `vN → vN+1` migration and a frozen fixture; never edit a shipped schema or fixture; never write a save whose version is newer than the app.**
    *Why:* spec N10; a fixture checksum test and docs/03's `Gate-Change:` trailer make an edit visible.
16. **Never lose the whole save for a bad run:** a run the game cannot parse or migrate is dropped alone; a damaged document falls back to `backup`; only when both are damaged does the app start fresh, and the bad rows are quarantined, never deleted.
    *Why:* spec S14, 8.6, 8.14.
17. **Never turn Premium off except with an explicit revocation date,** and never in "Reset all progress".
    *Why:* FINAL A.6 and C.25; `SaveService` enforces it for every writer.
18. **Test the real SQL on Node's `node:sqlite` through `SqlDriver`, and finish every save change with the simulator kill test.**
    *Why:* FINAL A.6; Jest proves the SQL, only a real kill proves the whole app.
19. **Checkpoint the WAL (`PRAGMA wal_checkpoint(TRUNCATE)`) whenever the app goes to the background.**
    *Why:* the device backup (spec D5) then copies one self-contained `save.db` (verified: the `-wal` file drops to 0 bytes).
20. **Write real-time games only at their save points** (wave end, pause, background, level end), never per frame.
    *Why:* FINAL A.6; a synchronous write per frame would stall the UI.
21. **At boot, write nothing before the direction check has passed** (docs/10), then hydrate synchronously before the first render.
    *Why:* module code runs again after a direction reload, so earlier writes would happen twice; synchronous SQLite lets S1 finish without a JS splash.

---

## 3. Navigation

### 3.1 Routes

| Spec | Route | Group | Params | Notes |
|---|---|---|---|---|
| S1 Splash | none | | | native splash (docs/09 art) while `startShell` hydrates synchronously |
| S2 First-run language | `LanguageChoice` | FirstRun | none | shown until a language is chosen |
| S13 Tutorial level | `Tutorial` | FirstRun | none | the Game screen body in tutorial mode; `gestureEnabled: false`. "Play the tutorial again" (S13 How to play) opens `Game` with `{ start: 'new', ref: { kind: 'tutorial' } }`, because FirstRun is gone after the first run |
| S3 Ad consent | none | | | Google's UMP form, presented by `ConsentPort` (docs/11) |
| S4 Home | `Home` | Main | none | root of the main app |
| S5 Game | `Game` | Main | `GameParams` | `gestureEnabled: false`, `usePreventRemove` |
| S6 Pause | none | | | overlay inside Game |
| S7 Result | none | | | overlay inside Game |
| S8 Levels | `Levels` | Main | none | |
| S9 Daily | `Daily` | Main | none | |
| S10 Statistics | `Stats` | Main | none | |
| S11 Settings | `Settings` | Main | none | |
| S11a Language | `SettingsLanguage` | Main | none | depth 2 |
| S11b About | `About` | Main | none | depth 2 |
| S11c Privacy policy | `PrivacyPolicy` | Main | none | depth 2, offline text |
| S11d Licences | `Licences` | Main | none | depth 2 |
| S12 Premium | `Premium` | Main | none | from Home, Settings or Result |
| S13 How to play | `HowToPlay` | Main | none | from Home or Pause |
| S14 Dialogs | none | | | dialog host above the navigator (docs/05) |
| S15 Debug | `Debug` | Debug | none | test builds only |

Depth from Home never exceeds 2 (spec 5): every Main route is pushed from Home or from one depth-1 screen.

### 3.2 The navigator

```tsx
// packages/shell/src/navigation/root-stack.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DebugRoute } from '@e07/shell/navigation/debug-route.tsx';
import {
  useIsFirstRun,
  useIsMainApp,
  useIsTestBuild,
  useNeedsLanguageChoice,
} from '@e07/shell/navigation/route-guards.ts';
import { DailyScreen } from '@e07/shell/screens/daily/daily-screen.tsx';
import { LanguageChoiceScreen } from '@e07/shell/screens/first-run/language-choice-screen.tsx';
import { TutorialScreen } from '@e07/shell/screens/first-run/tutorial-screen.tsx';
import { GameScreen } from '@e07/shell/screens/game/game-screen.tsx';
import { HomeScreen } from '@e07/shell/screens/home/home-screen.tsx';
import { HowToPlayScreen } from '@e07/shell/screens/how-to-play/how-to-play-screen.tsx';
import { LevelsScreen } from '@e07/shell/screens/levels/levels-screen.tsx';
import { PremiumScreen } from '@e07/shell/screens/premium/premium-screen.tsx';
import { AboutScreen } from '@e07/shell/screens/settings/about/about-screen.tsx';
import { SettingsLanguageScreen } from '@e07/shell/screens/settings/language/language-screen.tsx';
import { LicencesScreen } from '@e07/shell/screens/settings/licences/licences-screen.tsx';
import { PrivacyPolicyScreen } from '@e07/shell/screens/settings/privacy/privacy-policy-screen.tsx';
import { SettingsScreen } from '@e07/shell/screens/settings/settings-screen.tsx';
import { StatsScreen } from '@e07/shell/screens/stats/stats-screen.tsx';

/**
 * The ONE navigator (S2-S15). S1 is the native splash, S3 is Google's form,
 * S6/S7 are overlays inside Game, S14 dialogs render above the navigator.
 * Group order matters: the first rendered screen is the initial route.
 */
export const rootStack = createNativeStackNavigator({
  screenOptions: { headerShown: false },
  groups: {
    FirstRun: {
      if: useIsFirstRun,
      screens: {
        LanguageChoice: { screen: LanguageChoiceScreen, if: useNeedsLanguageChoice },
        Tutorial: { screen: TutorialScreen, options: { gestureEnabled: false } },
      },
    },
    Main: {
      if: useIsMainApp,
      screens: {
        Home: HomeScreen,
        Game: {
          screen: GameScreen,
          options: { gestureEnabled: false, fullScreenGestureEnabled: false },
        },
        Levels: LevelsScreen,
        Daily: DailyScreen,
        Stats: StatsScreen,
        Settings: SettingsScreen,
        SettingsLanguage: SettingsLanguageScreen,
        About: AboutScreen,
        PrivacyPolicy: PrivacyPolicyScreen,
        Licences: LicencesScreen,
        Premium: PremiumScreen,
        HowToPlay: HowToPlayScreen,
      },
    },
    Debug: {
      if: useIsTestBuild,
      screens: { Debug: DebugRoute },
    },
  },
});
```

- `headerShown: false` everywhere: the Shell draws its own top bar (docs/05), whose Back button calls `navigation.goBack()` and whose arrow flips with the direction.
- The variable is `rootStack`, not React Navigation's documented `RootStack`: docs/03's naming convention rejects a PascalCase non-component (verified).
- `LanguageChoice` has its own `if`, so a relaunch after a direction reload during first run (language chosen, tutorial not done) opens `Tutorial` directly.

```ts
// packages/shell/src/navigation/route-guards.ts
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import {
  selectIsFirstRun,
  selectNeedsLanguageChoice,
} from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

// Static-config `if` hooks: evaluated on every render of the navigator.
export function useIsFirstRun(): boolean {
  return useSettingsStore(selectIsFirstRun);
}

export function useIsMainApp(): boolean {
  return !useSettingsStore(selectIsFirstRun);
}

export function useNeedsLanguageChoice(): boolean {
  return useSettingsStore(selectNeedsLanguageChoice);
}

export function useIsTestBuild(): boolean {
  return TEST_ONLY !== null;
}
```

```tsx
// packages/shell/src/navigation/debug-route.tsx
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

import type { JSX } from 'react';

/** S15. Registered in the Debug group, whose `if` is false in store builds. */
export function DebugRoute(): JSX.Element | null {
  if (TEST_ONLY === null) return null;
  return <TEST_ONLY.DebugScreen />;
}
```

`TEST_ONLY` is docs/14's gate (`packages/shell/src/app/test-only.ts`, a literal `process.env.EXPO_PUBLIC_APP_VARIANT === 'store'` comparison around a `require`); `test-only-entry.ts` (same folder) re-exports the debug screen, and `TestOnlyApi` in `test-only-api.ts` names it `DebugScreen`. `TEST_ONLY !== null` may drive behaviour (the group's `if`, strict saves), never inclusion (docs/14 rule 5). In a store export the debug screen's code and the `SHELL_TEST_BUILD_ONLY` sentinel were absent; in a test export both were present (verified, see [Verified](#verified)).

### 3.3 Typed routes and params

```ts
// packages/shell/src/navigation/route-params.ts
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

/** Game (S5): continue the saved run, or start a new one. Params stay small and serializable. */
export type GameParams =
  { readonly start: 'resume' } | { readonly start: 'new'; readonly ref: RunRef };
```

```ts
// packages/shell/src/navigation/react-navigation.d.ts
import type { rootStack } from '@e07/shell/navigation/root-stack.tsx';
import type { StaticParamList } from '@react-navigation/native';

type RootStackParamList = StaticParamList<typeof rootStack>;

// Types useNavigation(), navigation.navigate() and Link everywhere, from the static config.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
```

A screen declares its params by its props type (`export type GameScreenProps = StaticScreenProps<GameParams>;`); `StaticParamList` infers them. With this file, `navigation.navigate('Nope')` and `navigate('Game', { start: 'bogus' })` are type errors (verified). The file needs `interface` for declaration merging, which docs/03 and docs/04 allow in `*.d.ts` only.

### 3.4 The container and direction

```tsx
// packages/shell/src/navigation/navigation-root.tsx
import { createStaticNavigation } from '@react-navigation/native';

import { readLayoutDirection } from '@e07/shell/i18n/direction.ts';
import { rootStack } from '@e07/shell/navigation/root-stack.tsx';

import type { InitialState, Theme } from '@react-navigation/native';
import type { JSX } from 'react';

const Navigation = createStaticNavigation(rootStack);

export type NavigationRootProps = {
  /** [Home, Game(resume)] when the last session was killed inside the Game screen. */
  readonly initialState: InitialState | undefined;
  readonly theme: Theme;
};

export function NavigationRoot({ initialState, theme }: NavigationRootProps): JSX.Element {
  const direction = readLayoutDirection();
  // exactOptionalPropertyTypes: omit the prop instead of passing undefined.
  const resume = initialState === undefined ? {} : { initialState };
  return <Navigation direction={direction} theme={theme} {...resume} />;
}
```

- React Navigation's own default is `I18nManager.getConstants().isRTL` (read in `NavigationContainer.tsx`); passing `readLayoutDirection()` makes the shared source explicit (docs/10 rule 14). Native stack passes the direction to react-native-screens, which lays out the header and transitions for it.
- No `linking` prop: the store app has no deep links. Test builds handle their debug links inside test-only code (docs/07, docs/14).
- `theme` is built from the Shell theme (docs/05); the example passes React Navigation's `DefaultTheme` placeholder.

### 3.5 Back on the Game screen opens Pause

```tsx
// packages/shell/src/screens/game/game-screen.tsx
import { StackActions, useNavigation, usePreventRemove } from '@react-navigation/native';
import { useRef } from 'react';
import { View } from 'react-native';

import { useGameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';
import { PauseOverlay } from '@e07/shell/screens/pause/pause-overlay.tsx';

import type { GameParams } from '@e07/shell/navigation/route-params.ts';
import type { StaticScreenProps } from '@react-navigation/native';
import type { JSX } from 'react';

export type GameScreenProps = StaticScreenProps<GameParams>;

/**
 * S5. Back (Android button, programmatic goBack) never leaves a live run: it opens
 * Pause, and Back inside Pause resumes. iOS edge swipe is off (gestureEnabled false).
 */
export function GameScreen({ route }: GameScreenProps): JSX.Element {
  const navigation = useNavigation();
  const controls = useGameSessionControls(route.params);
  const isLeavingRef = useRef(false);
  const isRunLive = controls.status === 'playing' || controls.status === 'paused';

  usePreventRemove(isRunLive, ({ data }) => {
    if (isLeavingRef.current) {
      navigation.dispatch(data.action);
    } else if (controls.status === 'playing') {
      controls.pause();
    } else {
      controls.resume();
    }
  });

  const handleHome = (): void => {
    isLeavingRef.current = true;
    controls.leaveToHome();
    navigation.dispatch(StackActions.popTo('Home'));
  };

  return (
    <View testID="game.screen">
      {controls.status === 'paused' ? (
        <PauseOverlay onResume={controls.resume} onHome={handleHome} />
      ) : null}
    </View>
  );
}
```

- `useGameSessionControls` (game host) exposes the type-erased session: `status`, `pause`, `resume`, `leaveToHome` (writes the run with `resumeOnLaunch: false`). The board, top bar and Result overlay are left out of this excerpt.
- The Home button sets the ref, then `popTo('Home')`; the prevent-remove callback sees the ref and dispatches the intercepted action (the pattern React Navigation documents). Won or lost runs are not "live", so Back from the Result overlay leaves normally.
- The app going to the background pauses the session (docs/08's lifecycle hook), so a return shows Pause (spec S5).

### 3.6 Flows

**First launch.** `LanguageChoice` (S2) dispatches `set-language` (which also sets `firstRun.languageChosen`). If the direction flips, docs/10's `restartForDirection` runs on the same Continue tap; after the reload `LanguageChoice`'s `if` is false and the FirstRun group opens `Tutorial`. The tutorial's last step dispatches `finish-tutorial`; `useIsFirstRun` turns false, the navigator re-renders with the Main group only, and React Navigation lands on `Home` (the first Main screen). Home then runs docs/11's `prepareAds`, which shows S3 where required.

**Relaunch inside a level.** If the saved run has `resumeOnLaunch: true`, hydration returns `initialState = [Home, Game({ start: 'resume' })]`; the Game screen restores the session paused (spec S5 "lands back here … in the exact same state", S1 otherwise "straight to Home").

**Settings → Language.** The text switches at once; a direction change shows docs/10's S14 "Restart to apply" dialog.

---

## 4. App state: the stores

### 4.1 Domains

| Store (hook) | State | Actions (`type`) | Save sections |
|---|---|---|---|
| settings (`useSettingsStore`) | `settings`, `firstRun` | `set-language`, `set-digits`, `set-sound`, `set-music`, `set-vibration`, `set-theme`, `set-color-blind`, `set-reduce-motion`, `set-hints-during-play`, `finish-tutorial` | `settings`, `firstRun` |
| progress (`useProgressStore`) | `levels`, `endlessBest`, `daily`, `hints`, `upsell` | `record-level-result`, `record-daily-result`, `record-endless-score`, `use-free-hint`, `record-upsell-shown`, `reset-progress` | `progress`, `daily`, `hints`, `upsell` |
| stats (`useStatsStore`) | `stats` | `record-finished-run`, `reset-statistics` | `stats` |
| premium (`usePremiumStore`, files in `stores/premium/`, docs/12) | the entitlement plus the S12 UI state machine (docs/12) | docs/12's actions; its `persistPremium(change: PremiumChange)` maps to the `premium` section | `premium` |

Ad frequency history and the last consent answer are written by the ads service (docs/11) through `SaveService.update` into the `ads` section; they need no React store. The level-end write that touches several sections is one `SaveService.update` with `refreshBackup: true` (section 6.9), composed from the pure `recordLevelResult`, `recordDailyResult` (section 8.2), `recordFinishedRun` (section 8.3) and docs/11's `recordLevelEnd`.

### 4.2 The pattern, shown on the settings store

```ts
// packages/shell/src/stores/settings-reducer.ts
import type { SaveDoc, SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

export type SettingsState = {
  readonly settings: SaveSettings;
  readonly firstRun: SaveDoc['firstRun'];
};

/** Every S11 row and the two first-run milestones. Imperative action names (docs/03). */
export type SettingsAction =
  | { readonly type: 'set-language'; readonly language: SaveSettings['language'] }
  | { readonly type: 'set-digits'; readonly digits: SaveSettings['digits'] }
  | { readonly type: 'set-sound'; readonly enabled: boolean; readonly volume: number }
  | { readonly type: 'set-music'; readonly enabled: boolean; readonly volume: number }
  | { readonly type: 'set-vibration'; readonly enabled: boolean }
  | { readonly type: 'set-theme'; readonly theme: SaveSettings['theme'] }
  | { readonly type: 'set-color-blind'; readonly enabled: boolean }
  | { readonly type: 'set-reduce-motion'; readonly reduceMotion: SaveSettings['reduceMotion'] }
  | { readonly type: 'set-hints-during-play'; readonly enabled: boolean }
  | { readonly type: 'finish-tutorial' };

const clampVolume = (volume: number): number => Math.min(100, Math.max(0, Math.round(volume)));

function withSettings(state: SettingsState, patch: Partial<SaveSettings>): SettingsState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

/** Pure. Unit-tested per action; the store only persists and publishes the result. */
export function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'set-language':
      return {
        settings: { ...state.settings, language: action.language },
        firstRun: { ...state.firstRun, languageChosen: true },
      };
    case 'set-digits':
      return withSettings(state, { digits: action.digits });
    case 'set-sound':
      return withSettings(state, {
        soundEnabled: action.enabled,
        soundVolume: clampVolume(action.volume),
      });
    case 'set-music':
      return withSettings(state, {
        musicEnabled: action.enabled,
        musicVolume: clampVolume(action.volume),
      });
    case 'set-vibration':
      return withSettings(state, { vibrationEnabled: action.enabled });
    case 'set-theme':
      return withSettings(state, { theme: action.theme });
    case 'set-color-blind':
      return withSettings(state, { colorBlind: action.enabled });
    case 'set-reduce-motion':
      return withSettings(state, { reduceMotion: action.reduceMotion });
    case 'set-hints-during-play':
      return withSettings(state, { hintsDuringPlay: action.enabled });
    case 'finish-tutorial':
      return { ...state, firstRun: { ...state.firstRun, tutorialDone: true } };
  }
}
```

```ts
// packages/shell/src/stores/settings-store.ts
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { useStores } from '@e07/shell/app/stores-context.tsx';
import { settingsReducer } from '@e07/shell/stores/settings-reducer.ts';

import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SettingsAction, SettingsState } from '@e07/shell/stores/settings-reducer.ts';
import type { StoreApi } from 'zustand/vanilla';

export type SettingsStoreState = SettingsState & {
  readonly dispatch: (action: SettingsAction) => void;
};

export type SettingsStore = StoreApi<SettingsStoreState>;

/** Thin: reduce -> persist (sync, one transaction) -> publish. Hydrated once at boot. */
export function createSettingsStore(save: SaveService): SettingsStore {
  const { settings, firstRun } = save.doc();
  return createStore<SettingsStoreState>()((set, get) => ({
    settings,
    firstRun,
    dispatch: (action) => {
      const next = settingsReducer(get(), action);
      save.update((doc) => ({ ...doc, settings: next.settings, firstRun: next.firstRun }));
      set(next);
    },
  }));
}

/** Primitives: `useSettingsStore(selectThemePreference)`; objects: `useShallow` (section 4.3). */
export function useSettingsStore<TSlice>(selector: (state: SettingsStoreState) => TSlice): TSlice {
  return useStore(useStores().settings, selector);
}
```

```ts
// packages/shell/src/stores/settings-selectors.ts
import type { SettingsStoreState } from '@e07/shell/stores/settings-store.ts';

type Settings = SettingsStoreState['settings'];

// Selectors return primitives or references that already live in the state.
// Anything that builds a new object or array goes through useShallow at the call site.
// `…Preference` names avoid a clash with docs/05's selectTheme(themes, selector) in theme-set.ts.
export const selectLanguage = (state: SettingsStoreState): Settings['language'] =>
  state.settings.language;
export const selectThemePreference = (state: SettingsStoreState): Settings['theme'] =>
  state.settings.theme;
export const selectReduceMotionPreference = (state: SettingsStoreState): Settings['reduceMotion'] =>
  state.settings.reduceMotion;
export const selectIsFirstRun = (state: SettingsStoreState): boolean =>
  !state.firstRun.tutorialDone;
export const selectNeedsLanguageChoice = (state: SettingsStoreState): boolean =>
  !state.firstRun.languageChosen;
export const selectDispatch = (state: SettingsStoreState): SettingsStoreState['dispatch'] =>
  state.dispatch;
```

```tsx
// packages/shell/src/app/stores-context.tsx
import { createContext, use } from 'react';

import type { PremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import type { SettingsStore } from '@e07/shell/stores/settings-store.ts';
import type { JSX, ReactNode } from 'react';

/**
 * The app-state stores, created once per app start (and per test) from the loaded
 * save document. Injected like services; never module-level singletons.
 */
export type ShellStores = {
  readonly settings: SettingsStore;
  readonly premium: PremiumStore;
};

const StoresContext = createContext<ShellStores | null>(null);

export type StoresProviderProps = {
  readonly stores: ShellStores;
  readonly children: ReactNode;
};

export function StoresProvider({ stores, children }: StoresProviderProps): JSX.Element {
  return <StoresContext value={stores}>{children}</StoresContext>;
}

/** Returns the stores. A missing provider is a programmer error, so it throws. */
export function useStores(): ShellStores {
  const stores = use(StoresContext);
  if (stores === null) throw new Error('useStores() needs a <StoresProvider> above it');
  return stores;
}
```

`ShellStores` gains `progress` and `stats` with the same shape: `create<Domain>Store(save)` returns a `StoreApi<<Domain>StoreState>` whose `dispatch` reduces, calls `save.update` with only its own sections, then `set`s. `premium` is already there: docs/12's `createPremiumStore(save)` hydrates from the `premium` section and only publishes, because docs/12's service writes the save (`persistPremium`) before it dispatches. The stores are vanilla (`zustand/vanilla`) so services (ads, Premium listeners) can read them outside React with `getState()`. docs/07's `renderWithShell` builds the same stores, with the same factories, from a seeded in-memory save.

### 4.3 The `useShallow` rule

```ts
// packages/shell/src/screens/settings/use-display-settings.ts
import { useShallow } from 'zustand/shallow';

import { selectThemePreference } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

export type DisplaySettings = {
  readonly theme: SaveSettings['theme'];
  readonly isColorBlind: boolean;
  readonly reduceMotion: SaveSettings['reduceMotion'];
};

/** The S11 DISPLAY rows: one primitive selector, one object selector through useShallow. */
export function useDisplaySettings(): DisplaySettings {
  const theme = useSettingsStore(selectThemePreference); // primitive: no useShallow needed
  const { isColorBlind, reduceMotion } = useSettingsStore(
    useShallow((state) => ({
      isColorBlind: state.settings.colorBlind,
      reduceMotion: state.settings.reduceMotion,
    })),
  );
  return { theme, isColorBlind, reduceMotion };
}
```

`useShallow` comes from `zustand/shallow` (v5 re-exports `zustand/react/shallow` there; checked in zustand 5.0.15's `shallow.d.ts`). Destructured booleans get an `is…` name (docs/03 rule 6); the property names in the document are data and keep their names. docs/05 adds a lint rule that rejects `useSettingsStore()` without a selector.

### 4.4 Testing a store

```ts
// packages/shell/src/stores/settings-store.test.ts
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { decodeSlot } from '@e07/shell/services/save/save-codec.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';
import { createSettingsStore } from '@e07/shell/stores/settings-store.ts';

function setup() {
  const store = createFakeSaveStore();
  const clock = { nowMs: () => 1_790_000_000_000, today: () => '2026-09-26' };
  const errorLog = { record: jest.fn(), entries: () => [] };
  const plan = planLoad({ current: null, backup: null, gameId: 'line-siege' });
  const save = createSaveService(
    { store, clock, errorLog, appVersion: '1.0.0', isStrict: true },
    plan,
    0,
  );
  save.applyLoadWrites();
  return { store, settings: createSettingsStore(save) };
}

describe('settings store', () => {
  it('persists a change before publishing it', () => {
    const { store, settings } = setup();
    settings.getState().dispatch({ type: 'set-theme', theme: 'dark' });
    const current = store.read('current');
    if (current === null) throw new Error('current slot missing');
    const decoded = decodeSlot(current, 'line-siege');
    expect(decoded.kind === 'ok' && decoded.doc.settings.theme).toBe('dark');
    expect(settings.getState().settings.theme).toBe('dark');
  });

  it('clamps volumes into 0..100', () => {
    const { settings } = setup();
    settings.getState().dispatch({ type: 'set-sound', enabled: true, volume: 180 });
    expect(settings.getState().settings.soundVolume).toBe(100);
  });
});
```

The reducers get one example test per action plus fast-check properties where they apply (volume always within 0..100; `finish-tutorial` idempotent). Store tests stay thin: persist-then-publish and nothing more.

---

## 5. The `GameSession` reducer

A session is one run of the game engine plus everything the Shell tracks around it: undo history, the move log, counters, status. It is pure data, changed only by `gameSessionReducer`, and held in a per-session vanilla store created by the game host (`createGameHost`, docs/02 section 7.4).

```ts
// packages/shell/src/game-host/game-session-types.ts
import type { GameEngine, Outcome } from '@e07/game-kit/contract/game-engine.ts';
import type { GameRules } from '@e07/game-kit/contract/game-rules.ts';
import type { RunRef } from '@e07/shell/services/save/schema/save-doc.ts';

export type SessionStatus = 'playing' | 'paused' | 'won' | 'lost';

export type RunLogEntry<TMove> =
  { readonly kind: 'move'; readonly move: TMove } | { readonly kind: 'continue' };

/** One level, daily, endless or tutorial run. Pure data held by a per-session store. */
export type GameSession<TState, TMove, TEvent> = {
  readonly ref: RunRef;
  readonly seed: number;
  readonly difficulty: number;
  readonly state: TState;
  /** States before each undoable move (memory only; rebuilt from `log` after a relaunch). */
  readonly past: readonly TState[];
  readonly log: readonly RunLogEntry<TMove>[];
  readonly status: SessionStatus;
  readonly outcome: Outcome;
  readonly moveCount: number;
  readonly undoCount: number;
  readonly hintsUsed: number;
  readonly continuesUsed: number;
  readonly playMs: number;
  /** Events of the last change; the board host builds a timeline when eventSeq changes. */
  readonly lastEvents: readonly TEvent[];
  readonly eventSeq: number;
};

/** Imperative, kebab-case action names (docs/03). */
export type SessionAction<TMove> =
  | { readonly type: 'apply-move'; readonly move: TMove }
  | { readonly type: 'undo' }
  | { readonly type: 'use-continue' }
  | { readonly type: 'use-hint' }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'add-play-time'; readonly ms: number };

/** The parts of the game module the reducer needs. */
export type SessionRules<TState, TMove, TEvent> = Pick<
  GameEngine<TState, TMove, TEvent>,
  'create' | 'applyMove' | 'outcome'
> &
  Pick<GameRules<TState, TMove, TEvent>, 'undo' | 'continueRun'>;

export type SessionStart = {
  readonly ref: RunRef;
  readonly seed: number;
  readonly difficulty: number;
};
```

```ts
// packages/shell/src/game-host/game-session-reducer.ts
import type { ApplyResult, Outcome } from '@e07/game-kit/contract/game-engine.ts';
import type {
  GameSession,
  RunLogEntry,
  SessionAction,
  SessionRules,
  SessionStart,
  SessionStatus,
} from '@e07/shell/game-host/game-session-types.ts';

function statusOf(outcome: Outcome): SessionStatus {
  return outcome.kind === 'playing' ? 'playing' : outcome.kind;
}

export function startGameSession<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  start: SessionStart,
): GameSession<TState, TMove, TEvent> {
  const state = rules.create(start.seed, start.difficulty);
  const outcome = rules.outcome(state);
  return {
    ...start,
    state,
    past: [],
    log: [],
    status: statusOf(outcome),
    outcome,
    moveCount: 0,
    undoCount: 0,
    hintsUsed: 0,
    continuesUsed: 0,
    playMs: 0,
    lastEvents: [],
    eventSeq: 0,
  };
}

function applied<TState, TMove, TEvent>(
  session: GameSession<TState, TMove, TEvent>,
  outcomeOf: SessionRules<TState, TMove, TEvent>['outcome'],
  change: { readonly result: ApplyResult<TState, TEvent>; readonly entry: RunLogEntry<TMove> },
): GameSession<TState, TMove, TEvent> {
  const outcome = outcomeOf(change.result.state);
  return {
    ...session,
    state: change.result.state,
    outcome,
    status: statusOf(outcome),
    log: [...session.log, change.entry],
    lastEvents: change.result.events,
    eventSeq: session.eventSeq + 1,
  };
}

function moved<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
  move: TMove,
): GameSession<TState, TMove, TEvent> {
  if (session.status !== 'playing') return session;
  const result = rules.applyMove(session.state, move);
  const next = applied(session, rules.outcome, { result, entry: { kind: 'move', move } });
  return { ...next, past: [...session.past, session.state], moveCount: session.moveCount + 1 };
}

export function canUndo<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
): boolean {
  if (session.status !== 'playing' || session.log.at(-1)?.kind !== 'move') return false;
  switch (rules.undo.kind) {
    case 'none':
      return false;
    case 'unlimited':
      return true;
    case 'limited':
      return session.undoCount < rules.undo.perLevel;
  }
}

function undone<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
): GameSession<TState, TMove, TEvent> {
  const previous = session.past.at(-1);
  if (previous === undefined || !canUndo(rules, session)) return session;
  return {
    ...session,
    state: previous,
    past: session.past.slice(0, -1),
    log: session.log.slice(0, -1),
    outcome: rules.outcome(previous),
    moveCount: session.moveCount - 1,
    undoCount: session.undoCount + 1,
    lastEvents: [],
    eventSeq: session.eventSeq + 1,
  };
}

/** Spec 8.10: one continue per run, only after a loss; undo cannot cross it. */
function continued<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
): GameSession<TState, TMove, TEvent> {
  const policy = rules.continueRun;
  if (session.status !== 'lost' || policy.kind !== 'once' || session.continuesUsed > 0)
    return session;
  const next = applied(session, rules.outcome, {
    result: policy.apply(session.state),
    entry: { kind: 'continue' },
  });
  return { ...next, past: [], continuesUsed: 1 };
}

/** Pure; unit- and property-tested. The Shell saves the result before animating it. */
export function gameSessionReducer<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  session: GameSession<TState, TMove, TEvent>,
  action: SessionAction<TMove>,
): GameSession<TState, TMove, TEvent> {
  switch (action.type) {
    case 'apply-move':
      return moved(rules, session, action.move);
    case 'undo':
      return undone(rules, session);
    case 'use-continue':
      return continued(rules, session);
    case 'pause':
      return session.status === 'playing' ? { ...session, status: 'paused' } : session;
    case 'resume':
      return session.status === 'paused' ? { ...session, status: 'playing' } : session;
    case 'use-hint':
      return { ...session, hintsUsed: session.hintsUsed + 1 };
    case 'add-play-time':
      return session.status === 'playing'
        ? { ...session, playMs: session.playMs + action.ms }
        : session;
  }
}
```

Design choices:

- **Undo keeps states, the save keeps moves.** In memory `past` holds full states for instant undo; the save stores only the move `log` plus the current `state` snapshot, and a relaunch rebuilds `past` by replaying the log (below). A long run stays a few kilobytes on disk.
- **A continue clears the undo history** (spec 8.10: continue is a one-time rescue, not a way to rewind further).
- **The reducer trusts `intentToMove`**: it only ever receives moves the engine produced as legal (a contract test checks `intentToMove ⊆ listMoves`, docs/02 section 7.5). A move while paused or finished is ignored.
- **Hints** are counted here; the hint move itself comes from `rules.hints.suggest` and the budget from the progress store (free hints per day) and docs/11 (rewarded ad).
- **Play time** accumulates only while playing, from frame-clock or AppState deltas the host clamps (a clock jump never adds hours).

```ts
// packages/shell/src/game-host/game-session-reducer.test.ts
import { gameSessionReducer, startGameSession } from '@e07/shell/game-host/game-session-reducer.ts';

import type { SessionRules } from '@e07/shell/game-host/game-session-types.ts';

type Counter = { readonly n: number };

const RULES: SessionRules<Counter, number, string> = {
  create: (seed) => ({ n: seed }),
  applyMove: (state, move) => ({ state: { n: state.n + move }, events: ['added'] }),
  outcome: (state) => {
    if (state.n >= 10) return { kind: 'won', score: state.n };
    if (state.n < 0) return { kind: 'lost', reasonKey: 'test.lose.below-zero' };
    return { kind: 'playing' };
  },
  undo: { kind: 'limited', perLevel: 1 },
  continueRun: {
    kind: 'once',
    descriptionId: 'test.continue.reset',
    apply: () => ({ state: { n: 0 }, events: ['continued'] }),
  },
};
const START = { ref: { kind: 'level', level: 1 } as const, seed: 2, difficulty: 10 };

describe('gameSessionReducer', () => {
  it('applies a move, records it and remembers the previous state', () => {
    const next = gameSessionReducer(RULES, startGameSession(RULES, START), {
      type: 'apply-move',
      move: 3,
    });
    expect(next.state).toStrictEqual({ n: 5 });
    expect(next.past).toStrictEqual([{ n: 2 }]);
    expect(next.log).toStrictEqual([{ kind: 'move', move: 3 }]);
    expect(next.eventSeq).toBe(1);
  });

  it('undoes one move and then refuses beyond the per-level limit', () => {
    const played = [3, 1].reduce(
      (s, move) => gameSessionReducer(RULES, s, { type: 'apply-move', move }),
      startGameSession(RULES, START),
    );
    const once = gameSessionReducer(RULES, played, { type: 'undo' });
    expect(once.state).toStrictEqual({ n: 5 });
    expect(gameSessionReducer(RULES, once, { type: 'undo' })).toBe(once);
  });

  it('ignores moves while paused', () => {
    const paused = gameSessionReducer(RULES, startGameSession(RULES, START), { type: 'pause' });
    expect(gameSessionReducer(RULES, paused, { type: 'apply-move', move: 1 })).toBe(paused);
  });

  it('allows exactly one continue after a loss', () => {
    const lost = gameSessionReducer(RULES, startGameSession(RULES, START), {
      type: 'apply-move',
      move: -5,
    });
    expect(lost.status).toBe('lost');
    const continued = gameSessionReducer(RULES, lost, { type: 'use-continue' });
    expect(continued.status).toBe('playing');
    expect(continued.past).toStrictEqual([]);
    const lostAgain = gameSessionReducer(RULES, continued, { type: 'apply-move', move: -1 });
    expect(gameSessionReducer(RULES, lostAgain, { type: 'use-continue' })).toBe(lostAgain);
  });
});
```

Each game adds property tests with its real engine: after any legal move sequence, undoing k moves equals the state k moves earlier; replaying the saved log reproduces the snapshot.

### 5.1 Saved run: write and restore

```ts
// packages/shell/src/game-host/saved-run.ts
import type { PersistenceSpec } from '@e07/game-kit/contract/persistence.ts';
import type {
  GameSession,
  RunLogEntry,
  SessionRules,
} from '@e07/shell/game-host/game-session-types.ts';
import type { SaveRun } from '@e07/shell/services/save/schema/save-doc.ts';

/** Session -> the `run` section. `past` is not stored: it is rebuilt by replaying `log`. */
export function toSavedRun<TState, TMove, TEvent>(
  session: GameSession<TState, TMove, TEvent>,
  stateVersion: number,
  shouldResumeOnLaunch: boolean,
): SaveRun {
  const {
    ref,
    seed,
    difficulty,
    state,
    log,
    moveCount,
    undoCount,
    hintsUsed,
    continuesUsed,
    playMs,
  } = session;
  return {
    ref,
    seed,
    difficulty,
    stateVersion,
    state,
    log,
    moveCount,
    undoCount,
    hintsUsed,
    continuesUsed,
    playMs,
    resumeOnLaunch: shouldResumeOnLaunch,
  };
}

export type RestoredRun<TState, TMove, TEvent> =
  | {
      readonly kind: 'restored';
      readonly session: GameSession<TState, TMove, TEvent>;
      readonly hasHistory: boolean;
    }
  | { readonly kind: 'dropped'; readonly reason: 'state-invalid' | 'state-not-migratable' };

function parseLog<TState, TMove>(
  persistence: PersistenceSpec<TState, TMove>,
  saved: SaveRun,
): readonly RunLogEntry<TMove>[] | null {
  const log: RunLogEntry<TMove>[] = [];
  for (const entry of saved.log) {
    if (entry.kind === 'continue') {
      log.push(entry);
      continue;
    }
    const move = persistence.parseMove(entry.move);
    if (move === null) return null;
    log.push({ kind: 'move', move });
  }
  return log;
}

/** Re-applies the log from create(seed, difficulty). Returns the undo stack and final state. */
function replay<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  saved: SaveRun,
  log: readonly RunLogEntry<TMove>[],
): { readonly past: readonly TState[]; readonly final: TState } {
  let state = rules.create(saved.seed, saved.difficulty);
  let past: TState[] = [];
  for (const entry of log) {
    if (entry.kind === 'move') {
      past = [...past, state];
      state = rules.applyMove(state, entry.move).state;
    } else if (rules.continueRun.kind === 'once') {
      past = [];
      state = rules.continueRun.apply(state).state;
    }
  }
  return { past, final: state };
}

function currentState<TState, TMove>(
  persistence: PersistenceSpec<TState, TMove>,
  saved: SaveRun,
): TState | null {
  return saved.stateVersion === persistence.stateVersion
    ? persistence.parseState(saved.state)
    : persistence.migrateState(saved.state, saved.stateVersion);
}

/**
 * Saved run -> paused session. The snapshot is the truth; replay only rebuilds undo
 * history and must reproduce the snapshot exactly (the determinism policy makes it so).
 */
export function restoreRun<TState, TMove, TEvent>(
  rules: SessionRules<TState, TMove, TEvent>,
  persistence: PersistenceSpec<TState, TMove>,
  saved: SaveRun,
): RestoredRun<TState, TMove, TEvent> {
  const state = currentState(persistence, saved);
  if (state === null) {
    const isSameVersion = saved.stateVersion === persistence.stateVersion;
    return { kind: 'dropped', reason: isSameVersion ? 'state-invalid' : 'state-not-migratable' };
  }
  const isSameVersion = saved.stateVersion === persistence.stateVersion;
  const log = isSameVersion ? parseLog(persistence, saved) : null;
  const replayed = log === null ? null : replay(rules, saved, log);
  const hasHistory = replayed !== null && JSON.stringify(replayed.final) === JSON.stringify(state);
  const outcome = rules.outcome(state);
  const session: GameSession<TState, TMove, TEvent> = {
    ref: saved.ref,
    seed: saved.seed,
    difficulty: saved.difficulty,
    state,
    past: hasHistory ? replayed.past : [],
    log: hasHistory && log !== null ? log : [],
    status: outcome.kind === 'playing' ? 'paused' : outcome.kind,
    outcome,
    moveCount: saved.moveCount,
    undoCount: saved.undoCount,
    hintsUsed: saved.hintsUsed,
    continuesUsed: saved.continuesUsed,
    playMs: saved.playMs,
    lastEvents: [],
    eventSeq: 0,
  };
  return { kind: 'restored', session, hasHistory };
}
```

- A replay that does not reproduce the snapshot (a determinism bug, or a game update that changed the rules without bumping `stateVersion`) keeps the snapshot and drops only the undo history, and the host logs it to `ErrorLogPort` (`'save'`). The player keeps their position.
- A restored playing run starts **paused** (spec S5: return shows the Pause menu).

### 5.2 When the run is written

| Moment | Write | `refreshBackup` |
|---|---|---|
| `apply-move`, `undo`, `use-continue`, `use-hint` (turn-based) | `run` (`resumeOnLaunch: true`) | no |
| Pause, app to background, Game screen loses focus | `run` with the current `playMs` | no |
| Pause → Home | `run` with `resumeOnLaunch: false` | no |
| Real-time save point (wave end, pause, background) | `run` from `realtime.snapshot(sim.get())` plus the `(tick, command)` log | no |
| Run ends (won or lost, first time for a daily) | `run: null` plus level result, stats, daily result, ad history, in ONE update | **yes** |
| Restart level | `run` for the new session | no |

The level-end write happens before S7 is shown (spec S7: "stars and statistics are saved BEFORE this screen appears"), and before the result animation starts.

---

## 6. The save service

### 6.1 Choosing the validator

| Option | For | Against | Verdict |
|---|---|---|---|
| **valibot 1.5.0** | modular pure functions, no `eval`/`new Function` anywhere in `dist/` (checked), types inferred from the schema, `strictObject`, `variant`, `exactOptional`, MIT, no dependencies, published 2026-09-09 (passes the 7-day `min-release-age`) | one more dependency | **chosen**, pinned exactly |
| zod 4.6.5 | popular, similar API | its JIT compiles validators with `new Function` behind a runtime probe (`util.allowsEval`); Hermes behaviour in Release unverified (docs/01 open issue 4) | rejected |
| Hand-written guards | no dependency | a nested document with ~60 fields means hundreds of lines to keep in sync with the types; easy to get subtly wrong | rejected |

valibot ran in every verified path: Jest (Node 26/V8), and Hermes V1 in a Release simulator build, where the first launch validated a fresh document before writing it and the next launch decoded and validated it (see [Verified](#verified)). Install with `npm install -E valibot@1.5.0 -w packages/shell` (a Shell dependency only, docs/02 section 4). docs/01's versions table lists it (section 3.2).

### 6.2 The v1 save document

Spec 8.6 → sections:

| Spec 8.6 item | Section | Reset by "Reset all progress" |
|---|---|---|
| current level state | `run` (engine state, move log, counters) | yes |
| level results, stars | `progress.levels`, `progress.endlessBest` | yes |
| daily results | `daily` | yes |
| statistics | `stats` | yes ("Reset statistics": this section only) |
| settings (and language) | `settings`, `firstRun` | no |
| Premium status | `premium` | **never** |
| (spec 8.5, 8.8, S12) hint allowance, ad caps, consent cache, upsell line | `hints`, `ads`, `upsell` | `hints`, `upsell` yes; `ads` no |

```ts
// packages/shell/src/services/save/schema/save-primitives.ts
import * as v from 'valibot';

/** Non-negative safe integer: counts, milliseconds, scores. */
export const COUNT = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
export const PERCENT = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100));
export const UINT32 = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4_294_967_295));
export const DIFFICULTY = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100));
export const LEVEL_NUMBER = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9999));
export const STARS = v.picklist([1, 2, 3]);

/** Local calendar day 'YYYY-MM-DD' (ClockPort.today()). */
export const DATE_KEY = v.pipe(
  v.string(),
  v.regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/),
);

/** Record keys are strings in JSON: level numbers as '1'..'9999'. */
export const LEVEL_KEY = v.pipe(v.string(), v.regex(/^[1-9]\d{0,3}$/));

/** kebab-case identifiers: game ids, counter ids. */
export const KEBAB_ID = v.pipe(v.string(), v.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/));
```

```ts
// packages/shell/src/services/save/schema/save-sections-v1.ts
import * as v from 'valibot';

import {
  COUNT,
  DATE_KEY,
  KEBAB_ID,
  LEVEL_KEY,
  PERCENT,
  STARS,
} from '@e07/shell/services/save/schema/save-primitives.ts';

export const SETTINGS_V1 = v.strictObject({
  /** null = "System" (docs/10 resolves it against the device languages). */
  language: v.nullable(v.picklist(['en', 'de', 'fa', 'ckb'])),
  digits: v.picklist(['automatic', 'latin', 'local']),
  soundEnabled: v.boolean(),
  soundVolume: PERCENT,
  musicEnabled: v.boolean(),
  musicVolume: PERCENT,
  vibrationEnabled: v.boolean(),
  theme: v.picklist(['system', 'light', 'dark']),
  colorBlind: v.boolean(),
  reduceMotion: v.picklist(['system', 'on', 'off']),
  hintsDuringPlay: v.boolean(),
});

export const FIRST_RUN_V1 = v.strictObject({
  languageChosen: v.boolean(),
  tutorialDone: v.boolean(),
});

export const LEVEL_RESULT_V1 = v.strictObject({
  stars: STARS,
  bestScore: COUNT,
  bestMoves: v.nullable(COUNT),
  completions: COUNT,
  firstCompletedOn: DATE_KEY,
});

export const PROGRESS_V1 = v.strictObject({
  levels: v.record(LEVEL_KEY, LEVEL_RESULT_V1),
  endlessBest: COUNT,
});

/** The first finished attempt of a day; replays never change it (spec S9). */
export const DAILY_RESULT_V1 = v.strictObject({
  won: v.boolean(),
  score: COUNT,
  moves: COUNT,
  playMs: COUNT,
});

export const DAILY_V1 = v.strictObject({
  /** Pruned to the last 60 days on write. */
  results: v.record(DATE_KEY, DAILY_RESULT_V1),
  streak: v.strictObject({ lastDate: v.nullable(DATE_KEY), length: COUNT }),
  bestStreak: COUNT,
});

export const STATS_V1 = v.strictObject({
  gamesPlayed: COUNT,
  wins: COUNT,
  losses: COUNT,
  playMs: COUNT,
  bestScore: v.strictObject({ level: COUNT, daily: COUNT, endless: COUNT }),
  currentWinStreak: COUNT,
  longestWinStreak: COUNT,
  /** Games and time per local day, pruned to the last 14 days (7-day chart). */
  days: v.record(DATE_KEY, v.strictObject({ games: COUNT, playMs: COUNT })),
  /** Game-specific counters by CounterSpec.id. */
  counters: v.record(KEBAB_ID, COUNT),
});

export const HINTS_V1 = v.strictObject({
  freeDate: v.nullable(DATE_KEY),
  freeUsed: COUNT,
});

/** docs/11: AdHistory (frequency caps survive a kill) + the last consent answer. */
export const ADS_V1 = v.strictObject({
  history: v.strictObject({
    lastInterstitialAtMs: v.nullable(COUNT),
    levelsCompletedSinceInterstitial: COUNT,
    didLastInterstitialFollowLoss: v.boolean(),
  }),
  consent: v.strictObject({
    canRequestAds: v.nullable(v.boolean()),
    isPrivacyOptionsRequired: v.boolean(),
  }),
});

/** Never touched by "Reset all progress" (spec S11). */
export const PREMIUM_V1 = v.strictObject({
  owned: v.boolean(),
  ownedSinceMs: v.nullable(COUNT),
  lastCheckedAtMs: v.nullable(COUNT),
  revokedAtMs: v.nullable(COUNT),
});

export const UPSELL_V1 = v.strictObject({
  lastShownOn: v.nullable(DATE_KEY),
});
```

```ts
// packages/shell/src/services/save/schema/save-run-v1.ts
import * as v from 'valibot';

import {
  COUNT,
  DATE_KEY,
  DIFFICULTY,
  LEVEL_NUMBER,
  UINT32,
} from '@e07/shell/services/save/schema/save-primitives.ts';

export const RUN_REF_V1 = v.variant('kind', [
  v.strictObject({ kind: v.literal('level'), level: LEVEL_NUMBER }),
  v.strictObject({ kind: v.literal('daily'), date: DATE_KEY }),
  v.strictObject({ kind: v.literal('endless') }),
  v.strictObject({ kind: v.literal('tutorial') }),
]);

export const RUN_LOG_ENTRY_V1 = v.variant('kind', [
  /** move is the game's JSON move; the game module validates it on replay. */
  v.strictObject({ kind: v.literal('move'), move: v.unknown() }),
  v.strictObject({ kind: v.literal('continue') }),
]);

/** The in-progress level. `state` belongs to the game (PersistenceSpec). */
export const RUN_V1 = v.strictObject({
  ref: RUN_REF_V1,
  seed: UINT32,
  difficulty: DIFFICULTY,
  stateVersion: v.pipe(COUNT, v.minValue(1)),
  state: v.unknown(),
  log: v.array(RUN_LOG_ENTRY_V1),
  moveCount: COUNT,
  undoCount: COUNT,
  hintsUsed: COUNT,
  continuesUsed: COUNT,
  playMs: COUNT,
  /** true while the Game screen is open: a relaunch reopens it, paused (spec S5). */
  resumeOnLaunch: v.boolean(),
});
```

```ts
// packages/shell/src/services/save/schema/save-doc-v1.ts
import * as v from 'valibot';

import { KEBAB_ID } from '@e07/shell/services/save/schema/save-primitives.ts';
import { RUN_V1 } from '@e07/shell/services/save/schema/save-run-v1.ts';
import {
  ADS_V1,
  DAILY_V1,
  FIRST_RUN_V1,
  HINTS_V1,
  PREMIUM_V1,
  PROGRESS_V1,
  SETTINGS_V1,
  STATS_V1,
  UPSELL_V1,
} from '@e07/shell/services/save/schema/save-sections-v1.ts';

/**
 * Save document v1. FROZEN once shipped: a change means save-doc-v2.ts, a
 * v1 -> v2 migration and new fixtures, never an edit here (spec N10).
 */
export const SAVE_DOC_V1 = v.strictObject({
  schemaVersion: v.literal(1),
  gameId: KEBAB_ID,
  settings: SETTINGS_V1,
  firstRun: FIRST_RUN_V1,
  progress: PROGRESS_V1,
  run: v.nullable(RUN_V1),
  daily: DAILY_V1,
  stats: STATS_V1,
  hints: HINTS_V1,
  ads: ADS_V1,
  premium: PREMIUM_V1,
  upsell: UPSELL_V1,
});

export type SaveDocV1 = v.InferOutput<typeof SAVE_DOC_V1>;
```

```ts
// packages/shell/src/services/save/schema/save-doc.ts
import { SAVE_DOC_V1 } from '@e07/shell/services/save/schema/save-doc-v1.ts';

import type { SaveDocV1 } from '@e07/shell/services/save/schema/save-doc-v1.ts';

/** Deeply immutable view of the latest document; reducers return new objects. */
export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** The only place that names the latest version. Bump both lines together. */
export const LATEST_SAVE_VERSION = 1;
export const LATEST_SAVE_SCHEMA = SAVE_DOC_V1;
export type SaveDoc = DeepReadonly<SaveDocV1>;
export type SaveSettings = SaveDoc['settings'];
export type SaveRun = NonNullable<SaveDoc['run']>;
export type RunRef = SaveRun['ref'];
```

```ts
// packages/shell/src/services/save/schema/default-save-doc.ts
import { LATEST_SAVE_VERSION } from '@e07/shell/services/save/schema/save-doc.ts';

import type { SaveDoc, SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

/** First-launch settings. Music is OFF by default (never over the player's music, 8.7). */
export const DEFAULT_SETTINGS: SaveSettings = {
  language: null,
  digits: 'automatic',
  soundEnabled: true,
  soundVolume: 80,
  musicEnabled: false,
  musicVolume: 60,
  vibrationEnabled: true,
  theme: 'system',
  colorBlind: false,
  reduceMotion: 'system',
  hintsDuringPlay: true,
};

export function createDefaultSaveDoc(gameId: string): SaveDoc {
  return {
    schemaVersion: LATEST_SAVE_VERSION,
    gameId,
    settings: DEFAULT_SETTINGS,
    firstRun: { languageChosen: false, tutorialDone: false },
    progress: { levels: {}, endlessBest: 0 },
    run: null,
    daily: { results: {}, streak: { lastDate: null, length: 0 }, bestStreak: 0 },
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      playMs: 0,
      bestScore: { level: 0, daily: 0, endless: 0 },
      currentWinStreak: 0,
      longestWinStreak: 0,
      days: {},
      counters: {},
    },
    hints: { freeDate: null, freeUsed: 0 },
    ads: {
      history: {
        lastInterstitialAtMs: null,
        levelsCompletedSinceInterstitial: 0,
        didLastInterstitialFollowLoss: false,
      },
      consent: { canRequestAds: null, isPrivacyOptionsRequired: false },
    },
    premium: {
      owned: false,
      ownedSinceMs: null,
      lastCheckedAtMs: null,
      revokedAtMs: null,
    },
    upsell: { lastShownOn: null },
  };
}
```

Notes on the shape:

- `strictObject` everywhere: an unknown key is a validation error, so a typo in a migration cannot slip through.
- `settings.language: null` means "System" and `digits: 'automatic' | 'latin' | 'local'` are docs/10's names (`languageFromRawSave`, `localeTagFor`).
- `ads.history` is docs/11's `AdHistory`; `ads.consent` mirrors the last `ConsentInfo`, so the Settings privacy row and `canRequestAds` are known synchronously at startup, before the consent refresh resolves. The offline fallback itself is UMP's cached `AdsConsent.getConsentInfo()` inside docs/11's adapter.
- `premium` is docs/12's entitlement section; a pending Ask-to-Buy is not persisted because StoreKit re-delivers it at launch (docs/12).
- Size: the full fixture (90-level progress, 60 daily results, a 200-move log) stays in the low tens of kilobytes; the spec budget is a p95 write under 5 ms (FINAL D.47), measured by docs/15's perf test.
- Settings booleans keep data names (`soundEnabled`, `colorBlind`); code that destructures them renames to `is…` (docs/03 rule 6). Volumes are integer percent here; docs/09's `AudioSettings` takes 0–1, so the glue passes `volume / 100`.

### 6.3 SQL: tables and pragmas

```ts
// packages/shell/src/services/save/save-db-schema.ts
/** File name inside expo-sqlite's default directory (Documents/SQLite). */
export const SAVE_DB_FILE = 'save.db';

/** Table structure version (PRAGMA user_version). NOT the document schemaVersion. */
export const DB_STRUCTURE_VERSION = 1;

/**
 * Run on every open. journal_mode is stored in the file; synchronous is per
 * connection, so both are always set. FULL: a committed move survives power loss.
 */
export const SAVE_DB_PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
`;

/** STRICT tables need SQLite >= 3.37 (expo-sqlite 57 bundles 3.50.3; Node 26.4 has 3.53.2). */
export const SAVE_DB_DDL_V1 = `
CREATE TABLE IF NOT EXISTS save_slots (
  slot           TEXT    PRIMARY KEY NOT NULL CHECK (slot IN ('current', 'backup')),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  app_version    TEXT    NOT NULL,
  written_at     INTEGER NOT NULL,
  write_count    INTEGER NOT NULL,
  checksum       TEXT    NOT NULL,
  payload        TEXT    NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS save_quarantine (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  quarantined_at INTEGER NOT NULL,
  slot           TEXT    NOT NULL,
  reason         TEXT    NOT NULL,
  schema_version INTEGER,
  payload        TEXT
) STRICT;
CREATE TABLE IF NOT EXISTS error_log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at_ms   INTEGER NOT NULL,
  area    TEXT    NOT NULL,
  message TEXT    NOT NULL,
  details TEXT
) STRICT;
PRAGMA user_version = 1;
`;

export const UPSERT_SLOT_SQL = `
INSERT INTO save_slots (slot, schema_version, app_version, written_at, write_count, checksum, payload)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (slot) DO UPDATE SET
  schema_version = excluded.schema_version,
  app_version = excluded.app_version,
  written_at = excluded.written_at,
  write_count = excluded.write_count,
  checksum = excluded.checksum,
  payload = excluded.payload`;

export const SELECT_SLOT_SQL = `
SELECT schema_version, app_version, written_at, write_count, checksum, payload
FROM save_slots WHERE slot = ?`;

export const QUARANTINE_SLOT_SQL = `
INSERT INTO save_quarantine (quarantined_at, slot, reason, schema_version, payload)
SELECT ?, slot, ?, schema_version, payload FROM save_slots WHERE slot = ?`;

export const TRIM_QUARANTINE_SQL = `
DELETE FROM save_quarantine WHERE id <= (SELECT MAX(id) FROM save_quarantine) - 10`;
```

- **Two version numbers.** `PRAGMA user_version` versions the tables (changes almost never); `schema_version` versions the JSON document (changes with features). A table change adds `SAVE_DB_DDL_V2` applied when `user_version = 1`, then bumps it.
- **`write_count`** rises across launches (diagnostics and the kill test); **`checksum`** is FNV-1a 32 of `payload` and catches bit rot or a hand-edited file that is still valid JSON.
- **`error_log`** holds `ErrorLogPort`'s ring buffer (newest 200 rows; the adapter is `sqlite-error-log-adapter.ts`, `area` stores the `ErrorSource`).
- **`perf_log`** (docs/15 section 3.2, test builds only) is created by docs/15's `perf-log.ts` in the same file. It is not part of `save_slots`, the save document or its migrations, and "Reset all progress" does not touch it.
- **Location:** `<app container>/Documents/SQLite/save.db` (+ `-wal`, `-shm`), included in the device backup (spec D5; verified path). The direction guard of docs/10 (`sqlite-kv-direction-guard-adapter.ts`) lives in `expo-sqlite/kv-store`'s own database (`ExpoSQLiteStorage`), not in `save.db`.

### 6.4 The drivers

```ts
// packages/shell/src/services/save/expo-sqlite-sql-driver.ts
import { openDatabaseSync } from 'expo-sqlite';

import type { ClosableSqlDriver, SqlRow } from '@e07/shell/services/save/sql-driver.ts';

/** Device driver. The file lives in <app>/Documents/SQLite/<fileName> (device backup, D5). */
export function createExpoSqliteSqlDriver(fileName: string): ClosableSqlDriver {
  const db = openDatabaseSync(fileName);
  return {
    exec: (sql) => {
      db.execSync(sql);
    },
    run: (sql, params) => {
      db.runSync(sql, [...params]);
    },
    get: (sql, params) => db.getFirstSync<SqlRow>(sql, [...params]),
    transaction: (work) => {
      db.withTransactionSync(work);
    },
    close: () => {
      db.closeSync();
    },
  };
}
```

`withTransactionSync` runs `BEGIN`, the task, `COMMIT`, and `ROLLBACK` + rethrow on an exception (read in expo-sqlite 57.0.3's `SQLiteDatabase.js`). The `SqlDriver` type itself is in docs/02 section 6.2.

```ts
// test/integration/save/node-sqlite-sql-driver.ts
import { DatabaseSync } from 'node:sqlite';

import type { ClosableSqlDriver } from '@e07/shell/services/save/sql-driver.ts';

/** Node 26 built-in SQLite: runs the Shell's real save SQL in Jest (root test/: Node types). */
export function createNodeSqliteSqlDriver(path: string): ClosableSqlDriver {
  const db = new DatabaseSync(path);
  return {
    exec: (sql) => {
      db.exec(sql);
    },
    run: (sql, params) => {
      db.prepare(sql).run(...params);
    },
    get: (sql, params) => {
      const row = db.prepare(sql).get(...params);
      // node:sqlite returns null-prototype objects; copy so toStrictEqual compares plain rows.
      return row === undefined ? null : { ...row };
    },
    transaction: (work) => {
      db.exec('BEGIN');
      try {
        work();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => {
      db.close();
    },
  };
}
```

- It lives under the root `test/` because only the root tsconfig has Node types (docs/04, docs/07). The kill-test inspector in tooling carries its own identical copy (`packages/tooling/src/save/node-sqlite-sql-driver.ts`) because nothing may import tooling and tooling does not import `test/`.
- The spread in `get` is needed: without it every `toStrictEqual` on a row failed ("serializes to the same string") because `node:sqlite` rows have a null prototype (verified).
- `node:sqlite` loads with no flag and no warning on Node 26.4 and works inside jest-expo's environment (verified).

### 6.5 The store over the driver

```ts
// packages/shell/src/services/save/sqlite-save-store.ts
import {
  DB_STRUCTURE_VERSION,
  QUARANTINE_SLOT_SQL,
  SAVE_DB_DDL_V1,
  SAVE_DB_PRAGMAS,
  SELECT_SLOT_SQL,
  TRIM_QUARANTINE_SQL,
  UPSERT_SLOT_SQL,
} from '@e07/shell/services/save/save-db-schema.ts';

import type { SlotName, SlotRecord, SaveStore } from '@e07/shell/services/save/save-store.ts';
import type { SqlDriver, SqlRow } from '@e07/shell/services/save/sql-driver.ts';

function toSlotRecord(row: SqlRow | null): SlotRecord | null {
  if (row === null) return null;
  const { schema_version, app_version, written_at, write_count, checksum, payload } = row;
  if (
    typeof schema_version !== 'number' ||
    typeof app_version !== 'string' ||
    typeof written_at !== 'number' ||
    typeof write_count !== 'number' ||
    typeof checksum !== 'string' ||
    typeof payload !== 'string'
  ) {
    return null;
  }
  return {
    schemaVersion: schema_version,
    appVersion: app_version,
    writtenAtMs: written_at,
    writeCount: write_count,
    checksum,
    payload,
  };
}

function upsert(driver: SqlDriver, slot: SlotName, record: SlotRecord): void {
  driver.run(UPSERT_SLOT_SQL, [
    slot,
    record.schemaVersion,
    record.appVersion,
    record.writtenAtMs,
    record.writeCount,
    record.checksum,
    record.payload,
  ]);
}

/** Creates tables on first open; refuses to touch a DB made by a newer app. */
function prepareDatabase(driver: SqlDriver): void {
  driver.exec(SAVE_DB_PRAGMAS);
  const version = driver.get('PRAGMA user_version', [])?.['user_version'];
  if (typeof version === 'number' && version > DB_STRUCTURE_VERSION) {
    throw new Error(`save.db structure v${String(version)} is newer than this app`);
  }
  if (version === 0) driver.exec(SAVE_DB_DDL_V1);
}

export function createSqliteSaveStore(driver: SqlDriver): SaveStore {
  prepareDatabase(driver);
  return {
    read: (slot) => toSlotRecord(driver.get(SELECT_SLOT_SQL, [slot])),
    write: (slots) => {
      driver.transaction(() => {
        if (slots.current !== undefined) upsert(driver, 'current', slots.current);
        if (slots.backup !== undefined) upsert(driver, 'backup', slots.backup);
      });
    },
    quarantine: (slot, reason, atMs) => {
      driver.transaction(() => {
        driver.run(QUARANTINE_SLOT_SQL, [atMs, reason, slot]);
        driver.run(TRIM_QUARANTINE_SQL, []);
      });
    },
    checkpoint: () => {
      driver.get('PRAGMA wal_checkpoint(TRUNCATE)', []);
    },
  };
}
```

`fake-save-store.ts` (same folder) keeps the two slots in a `Map`, records quarantines, and can throw once on `write` (`failNextWrite`) to simulate a crash before `COMMIT`; store and screen tests use it (docs/07's `renderWithShell` builds its save on it), SQL tests use the Node driver.

```ts
// packages/shell/src/services/save/fake-save-store.ts
import type { SaveStore, SlotName, SlotRecord } from '@e07/shell/services/save/save-store.ts';

/** In-memory SaveStore for component and store tests; `failNextWrite` simulates a crash. */
export type FakeSaveStore = SaveStore & {
  readonly slots: Map<SlotName, SlotRecord>;
  readonly quarantined: { slot: SlotName; reason: string }[];
  failNextWrite: boolean;
};

export function createFakeSaveStore(): FakeSaveStore {
  const fake: FakeSaveStore = {
    slots: new Map(),
    quarantined: [],
    failNextWrite: false,
    read: (slot) => fake.slots.get(slot) ?? null,
    write: (slots) => {
      if (fake.failNextWrite) {
        fake.failNextWrite = false;
        throw new Error('simulated crash before COMMIT');
      }
      if (slots.current !== undefined) fake.slots.set('current', slots.current);
      if (slots.backup !== undefined) fake.slots.set('backup', slots.backup);
    },
    quarantine: (slot, reason) => {
      fake.quarantined.push({ slot, reason });
    },
    checkpoint: () => undefined,
  };
  return fake;
}
```

### 6.6 Checksum and codec

```ts
// packages/shell/src/services/save/checksum.ts
/** FNV-1a 32-bit over UTF-16 code units, as 8 lowercase hex chars. Detects bit rot and hand edits. */
export function fnv1a32(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
```

```ts
// packages/shell/src/services/save/save-codec.ts
import * as v from 'valibot';

import { fnv1a32 } from '@e07/shell/services/save/checksum.ts';
import { migrateToLatest } from '@e07/shell/services/save/migrations/save-migrations.ts';
import {
  LATEST_SAVE_SCHEMA,
  LATEST_SAVE_VERSION,
} from '@e07/shell/services/save/schema/save-doc.ts';

import type { SlotRecord } from '@e07/shell/services/save/save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type DecodeResult =
  | { readonly kind: 'ok'; readonly doc: SaveDoc; readonly migratedFrom: number | null }
  | { readonly kind: 'newer'; readonly version: number }
  | { readonly kind: 'damaged'; readonly reason: string };

export type EncodeMeta = {
  readonly appVersion: string;
  readonly writtenAtMs: number;
  readonly writeCount: number;
};

/** Validates the latest schema; returns issues as one short string for the error log. */
export function validateSaveDoc(
  doc: unknown,
): { readonly doc: SaveDoc } | { readonly error: string } {
  const result = v.safeParse(LATEST_SAVE_SCHEMA, doc);
  if (result.success) return { doc: result.output };
  const first = result.issues[0];
  return { error: `${v.getDotPath(first) ?? '(root)'}: ${first.message}` };
}

export function encodeSaveDoc(doc: SaveDoc, meta: EncodeMeta): SlotRecord {
  const payload = JSON.stringify(doc);
  return { schemaVersion: doc.schemaVersion, checksum: fnv1a32(payload), payload, ...meta };
}

function parseJson(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return undefined;
  }
}

/** Row -> latest document. Never throws; never writes. */
export function decodeSlot(record: SlotRecord, gameId: string): DecodeResult {
  if (record.schemaVersion > LATEST_SAVE_VERSION)
    return { kind: 'newer', version: record.schemaVersion };
  if (fnv1a32(record.payload) !== record.checksum) return { kind: 'damaged', reason: 'checksum' };
  const parsed = parseJson(record.payload);
  if (parsed === undefined) return { kind: 'damaged', reason: 'json' };
  const isOld = record.schemaVersion < LATEST_SAVE_VERSION;
  const migrated = isOld ? migrateToLatest(parsed, record.schemaVersion) : parsed;
  const checked = validateSaveDoc(migrated);
  if ('error' in checked) return { kind: 'damaged', reason: `schema ${checked.error}` };
  if (checked.doc.gameId !== gameId) return { kind: 'damaged', reason: 'game-id' };
  return { kind: 'ok', doc: checked.doc, migratedFrom: isOld ? record.schemaVersion : null };
}
```

`gameId` inside the document stops a debug-imported save of another game from loading.

### 6.7 The load plan (pure)

Reading is pure: both rows go in, a document, an outcome and a list of planned writes come out. The writes run later, after the direction check (rule 21).

```ts
// packages/shell/src/services/save/load-plan.ts
import { decodeSlot } from '@e07/shell/services/save/save-codec.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import type { DecodeResult } from '@e07/shell/services/save/save-codec.ts';
import type { SlotName, SlotRecord } from '@e07/shell/services/save/save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

/** What the player is told (S14) and what the debug menu shows. */
export type LoadOutcome =
  | { readonly kind: 'fresh' }
  | { readonly kind: 'loaded' }
  | { readonly kind: 'migrated'; readonly from: number }
  | { readonly kind: 'restored-from-backup'; readonly reason: string }
  | { readonly kind: 'reset-after-damage'; readonly reason: string }
  | { readonly kind: 'newer-version'; readonly found: number };

export type PlannedWrite =
  | { readonly kind: 'quarantine'; readonly slot: SlotName; readonly reason: string }
  /** Write plan.doc into current and backup in one transaction. */
  | { readonly kind: 'write-both' };

/** Pure result of reading both slots. Writes run later, after the direction check. */
export type LoadPlan = {
  readonly doc: SaveDoc;
  readonly outcome: LoadOutcome;
  readonly writes: readonly PlannedWrite[];
  /** true for a newer-version save: nothing is ever written this session. */
  readonly isReadOnly: boolean;
};

/** Highest write_count seen, so the counter keeps rising across launches. */
export function lastWriteCount(input: LoadInput): number {
  return Math.max(input.current?.writeCount ?? 0, input.backup?.writeCount ?? 0);
}

export type LoadInput = {
  readonly current: SlotRecord | null;
  readonly backup: SlotRecord | null;
  readonly gameId: string;
};

const MISSING: DecodeResult = { kind: 'damaged', reason: 'missing' };

function fromOk(decoded: Extract<DecodeResult, { kind: 'ok' }>): LoadPlan {
  const outcome: LoadOutcome =
    decoded.migratedFrom === null
      ? { kind: 'loaded' }
      : { kind: 'migrated', from: decoded.migratedFrom };
  return { doc: decoded.doc, outcome, writes: [{ kind: 'write-both' }], isReadOnly: false };
}

function readOnly(gameId: string, found: number): LoadPlan {
  return {
    doc: createDefaultSaveDoc(gameId),
    outcome: { kind: 'newer-version', found },
    writes: [],
    isReadOnly: true,
  };
}

function quarantines(input: LoadInput, reason: string): PlannedWrite[] {
  const slots: SlotName[] = [];
  if (input.current !== null) slots.push('current');
  if (input.backup !== null) slots.push('backup');
  return slots.map((slot) => ({ kind: 'quarantine', slot, reason }));
}

/** Decides what to load. Every branch is covered by load-plan.test.ts. */
export function planLoad(input: LoadInput): LoadPlan {
  const current = input.current === null ? MISSING : decodeSlot(input.current, input.gameId);
  if (current.kind === 'ok') return fromOk(current);
  if (current.kind === 'newer') return readOnly(input.gameId, current.version);
  const backup = input.backup === null ? MISSING : decodeSlot(input.backup, input.gameId);
  if (backup.kind === 'newer') return readOnly(input.gameId, backup.version);
  if (backup.kind === 'ok') {
    const restored = fromOk(backup);
    const bad: PlannedWrite[] =
      input.current === null
        ? []
        : [{ kind: 'quarantine', slot: 'current', reason: current.reason }];
    return {
      ...restored,
      outcome: { kind: 'restored-from-backup', reason: current.reason },
      writes: [...bad, ...restored.writes],
    };
  }
  const isFirstLaunch = input.current === null && input.backup === null;
  return {
    doc: createDefaultSaveDoc(input.gameId),
    outcome: isFirstLaunch
      ? { kind: 'fresh' }
      : { kind: 'reset-after-damage', reason: current.reason },
    writes: [...quarantines(input, current.reason), { kind: 'write-both' }],
    isReadOnly: false,
  };
}
```

| Outcome | What the player sees (S14) | Writes |
|---|---|---|
| `fresh` | nothing | both slots |
| `loaded` | nothing | both slots (refreshes `backup`) |
| `migrated` | nothing | both slots, now the latest version |
| `restored-from-backup` | "Your progress couldn't be loaded. A backup copy was restored." | quarantine `current`, then both slots from backup |
| `reset-after-damage` | "Your progress couldn't be loaded." (new S14 text; see Open issues) | quarantine both, then fresh |
| `newer-version` | "A new version of the saved data was found… please update" at every launch | **none**: the session plays in memory and saves nothing |

### 6.8 The single writer

```ts
// packages/shell/src/services/save/save-service.ts
import { encodeSaveDoc, validateSaveDoc } from '@e07/shell/services/save/save-codec.ts';

import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { LoadPlan } from '@e07/shell/services/save/load-plan.ts';
import type { SaveStore } from '@e07/shell/services/save/save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

/** Premium only turns off with an explicit revocation date (never by reset or absence). */
export function keepPremiumUnlessRevoked(previous: SaveDoc, next: SaveDoc): SaveDoc {
  const isLost = previous.premium.owned && !next.premium.owned;
  return isLost && next.premium.revokedAtMs === null
    ? { ...next, premium: previous.premium }
    : next;
}

export type SaveServiceDeps = {
  readonly store: SaveStore;
  readonly clock: ClockPort;
  readonly errorLog: ErrorLogPort;
  readonly appVersion: string;
  /** Test variant: an invalid document throws (fail loudly in Jest and E2E). */
  readonly isStrict: boolean;
};

/** The single writer of the save document. Stores call update(); nothing else writes. */
export type SaveService = {
  readonly doc: () => SaveDoc;
  /** Validate -> write `current` in one transaction. With refreshBackup: `backup` too. */
  readonly update: (
    recipe: (doc: SaveDoc) => SaveDoc,
    options?: { readonly refreshBackup: boolean },
  ) => void;
  readonly applyLoadWrites: () => void;
  readonly checkpoint: () => void;
  readonly isReadOnly: () => boolean;
};

/** Validates, encodes and writes; the write counter keeps rising across launches. */
function createWriter(
  deps: SaveServiceDeps,
  writeCountBase: number,
): (next: SaveDoc, isBoth: boolean) => void {
  let writeCount = writeCountBase;
  return (next, isBoth) => {
    const checked = validateSaveDoc(next);
    if ('error' in checked) {
      const error = new Error(`invalid save document not written: ${checked.error}`);
      deps.errorLog.record('save', error);
      if (deps.isStrict) throw error;
      return;
    }
    writeCount += 1;
    const meta = { appVersion: deps.appVersion, writtenAtMs: deps.clock.nowMs(), writeCount };
    const record = encodeSaveDoc(checked.doc, meta);
    deps.store.write(isBoth ? { current: record, backup: record } : { current: record });
  };
}

export function createSaveService(
  deps: SaveServiceDeps,
  plan: LoadPlan,
  writeCountBase: number,
): SaveService {
  let doc = plan.doc;
  const persist = createWriter(deps, writeCountBase);
  return {
    doc: () => doc,
    update: (recipe, options) => {
      doc = keepPremiumUnlessRevoked(doc, recipe(doc));
      if (!plan.isReadOnly) persist(doc, options?.refreshBackup === true);
    },
    applyLoadWrites: () => {
      for (const write of plan.writes) {
        if (write.kind === 'quarantine') {
          deps.store.quarantine(write.slot, write.reason, deps.clock.nowMs());
        } else {
          persist(doc, true);
        }
      }
    },
    checkpoint: () => {
      deps.store.checkpoint();
    },
    isReadOnly: () => plan.isReadOnly,
  };
}
```

- **Every write is a synchronous transaction.** When `update` returns, the change is committed (WAL + `FULL`), so the next line may animate, navigate or finish a StoreKit transaction.
- **docs/12's `persistPremium({ isPremium: true })`** is `save.update((doc) => ({ ...doc, premium: { ...doc.premium, owned: true, ownedSinceMs: doc.premium.ownedSinceMs ?? clock.nowMs(), revokedAtMs: null } }), { refreshBackup: true })`; `persistPremium({ isPremium: false, revokedAtMs })` writes `owned: false` with that date (from the transaction's `revocationDateMs`). A change with `owned: false` and `revokedAtMs: null` is undone by the guard, so Premium stays on.
- **In a store build an invalid document is logged, not written, and memory moves on**; the next valid write repairs the disk. In test builds it throws, so Jest, E2E and the kill test surface the bug.

### 6.9 Write path and backup path

```
store.dispatch(action)
  → reducer (pure)                                  new section
  → SaveService.update(recipe, { refreshBackup })   whole new document
      → keepPremiumUnlessRevoked                    Premium guard
      → validateSaveDoc (valibot)                   invalid: log (+ throw in test builds), no write
      → encodeSaveDoc: JSON.stringify + fnv1a32
      → SaveStore.write: BEGIN; UPSERT current (+ backup); COMMIT   (withTransactionSync)
  → store.set(next)                                 UI updates
```

The backup is refreshed from a **validated** document at three moments only: at startup (`applyLoadWrites`, after a successful load or migration), at every run end, and after a Premium change. Per-move writes touch `current` only, so a bad write sequence can never overwrite the last good backup in the middle of a level.

### 6.10 Reset functions

```ts
// packages/shell/src/services/save/reset-progress.ts
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

/**
 * S11 "Reset all progress": levels, stars, run, daily, statistics, hints, upsell.
 * KEPT: settings (incl. language), firstRun, ads consent/caps, and premium (never reset).
 */
export function resetAllProgress(doc: SaveDoc): SaveDoc {
  const fresh = createDefaultSaveDoc(doc.gameId);
  return {
    ...doc,
    progress: fresh.progress,
    run: fresh.run,
    daily: fresh.daily,
    stats: fresh.stats,
    hints: fresh.hints,
    upsell: fresh.upsell,
  };
}

/** S10/S11 "Reset statistics": the stats section only. */
export function resetStatistics(doc: SaveDoc): SaveDoc {
  return { ...doc, stats: createDefaultSaveDoc(doc.gameId).stats };
}
```

Both are applied with `refreshBackup: true`, so a reset is not undone by a later backup restore. A test decodes the full fixture, resets it, and asserts `premium`, `settings` and `firstRun` are unchanged.

### 6.11 Migrations and frozen fixtures

```ts
// packages/shell/src/services/save/migrations/save-migrations.ts
import { LATEST_SAVE_VERSION } from '@e07/shell/services/save/schema/save-doc.ts';

/** A pure step vN -> vN+1 over plain JSON. Never reads the clock, the device or the Shell. */
export type SaveMigration = {
  readonly from: number;
  readonly migrate: (doc: Readonly<Record<string, unknown>>) => Record<string, unknown>;
};

/**
 * Ordered, append-only. Index i migrates version i+1 -> i+2.
 * v1 is the first shipped version, so the list is empty until v2 exists.
 */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Runs every step from `fromVersion` to LATEST; null if a step is missing or throws. */
export function migrateToLatest(doc: unknown, fromVersion: number): unknown {
  let current: unknown = doc;
  for (let version = fromVersion; version < LATEST_SAVE_VERSION; version += 1) {
    const step = SAVE_MIGRATIONS.find((migration) => migration.from === version);
    if (step === undefined || !isRecord(current)) return null;
    current = { ...step.migrate(current), schemaVersion: version + 1 };
  }
  return current;
}
```

Adding version 2, in one commit (with a `Gate-Change:` trailer, docs/03 rule 16):

1. Copy `save-doc-v1.ts` to `save-doc-v2.ts`, change the copy (`v.literal(2)`), leave v1 untouched.
2. Point `LATEST_SAVE_VERSION = 2` and `LATEST_SAVE_SCHEMA = SAVE_DOC_V2` in `save-doc.ts`; update `default-save-doc.ts`.
3. Write the pure step and append it to `SAVE_MIGRATIONS`:

```ts
// packages/shell/src/services/save/migrations/v1-to-v2.ts  (EXAMPLE: add only when v2 ships)
import type { SaveMigration } from '@e07/shell/services/save/migrations/save-migrations.ts';

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** v2 adds settings.textScale (percent). Pure: no clock, no device, no defaults from runtime. */
export const V1_TO_V2: SaveMigration = {
  from: 1,
  migrate: (doc) => ({ ...doc, settings: { ...asRecord(doc['settings']), textScale: 100 } }),
};
```

4. Add `save-v2.minimal.json` and `save-v2.full.json` fixtures (written by the new app, then frozen) and their checksums; keep every v1 fixture.
5. Add the step's own test (v1 fixture → exact expected v2 JSON) and a fast-check property (any valid v1 document built from the schema's arbitraries migrates to a valid v2).

The frozen-fixture test runs every fixture through the real decoder:

```ts
// packages/shell/src/services/save/fixtures/save-fixtures.test.ts
import { fnv1a32 } from '@e07/shell/services/save/checksum.ts';
import { decodeSlot, encodeSaveDoc } from '@e07/shell/services/save/save-codec.ts';

import { FIXTURE_CHECKSUMS } from './fixture-checksums.ts';
import saveV1Full from './save-v1.full.json';
import saveV1Minimal from './save-v1.minimal.json';

import type { SlotRecord } from '@e07/shell/services/save/save-store.ts';

/** Every save version ever shipped, as the JSON an old app wrote. Append only. */
const FIXTURES = [
  { name: 'save-v1.minimal', version: 1, json: saveV1Minimal },
  { name: 'save-v1.full', version: 1, json: saveV1Full },
] as const;

function asStoredRow(json: unknown, version: number): SlotRecord {
  const payload = JSON.stringify(json);
  return {
    schemaVersion: version,
    appVersion: 'fixture',
    writtenAtMs: 0,
    writeCount: 1,
    checksum: fnv1a32(payload),
    payload,
  };
}

describe('save fixtures', () => {
  it.each(FIXTURES)('keeps $name frozen', ({ name, json }) => {
    expect(fnv1a32(JSON.stringify(json))).toBe(FIXTURE_CHECKSUMS[name]);
  });

  it.each(FIXTURES)('upgrades $name to a valid latest document', ({ json, version }) => {
    const decoded = decodeSlot(asStoredRow(json, version), 'line-siege');
    expect(decoded.kind).toBe('ok');
  });

  it.each(FIXTURES)('survives an encode/decode round trip for $name', ({ json, version }) => {
    const first = decodeSlot(asStoredRow(json, version), 'line-siege');
    if (first.kind !== 'ok') throw new Error('fixture must decode');
    const again = decodeSlot(
      encodeSaveDoc(first.doc, { appVersion: 't', writtenAtMs: 1, writeCount: 2 }),
      'line-siege',
    );
    expect(again).toStrictEqual({ kind: 'ok', doc: first.doc, migratedFrom: null });
  });
});
```

`fixture-checksums.ts` maps each fixture name to its `fnv1a32` (for example `'save-v1.minimal': '27681806'`). Changing a fixture or a checksum is a gated change (docs/03 rule 16, docs/16 `gatedPaths`). The minimal fixture is the default document; the full one fills every section, including a run with a move log, Premium owned and a 2-day streak.

### 6.12 Tests on `node:sqlite`

```ts
// test/integration/save/sqlite-save-store.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { encodeSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import { createNodeSqliteSqlDriver } from './node-sqlite-sql-driver.ts';

const META = { appVersion: '1.0.0', writtenAtMs: 1_790_000_000_000, writeCount: 1 };

describe('sqlite-save-store', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'save-sql-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('uses WAL and synchronous FULL', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    driver.exec('PRAGMA synchronous = NORMAL'); // node:sqlite already defaults to FULL (2)
    createSqliteSaveStore(driver);
    expect(driver.get('PRAGMA journal_mode', [])).toStrictEqual({ journal_mode: 'wal' });
    expect(driver.get('PRAGMA synchronous', [])).toStrictEqual({ synchronous: 2 });
    driver.close();
  });

  it('reloads a document written to current and backup', () => {
    const path = join(dir, 'save.db');
    const store = createSqliteSaveStore(createNodeSqliteSqlDriver(path));
    const record = encodeSaveDoc(createDefaultSaveDoc('line-siege'), META);
    store.write({ current: record, backup: record });
    const reopened = createSqliteSaveStore(createNodeSqliteSqlDriver(path));
    const plan = planLoad({
      current: reopened.read('current'),
      backup: reopened.read('backup'),
      gameId: 'line-siege',
    });
    expect(plan.outcome).toStrictEqual({ kind: 'loaded' });
    expect(plan.doc).toStrictEqual(createDefaultSaveDoc('line-siege'));
  });

  it('restores the backup when current is corrupted and quarantines current', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    const store = createSqliteSaveStore(driver);
    const record = encodeSaveDoc(createDefaultSaveDoc('line-siege'), META);
    store.write({ current: { ...record, payload: '{"broken":' }, backup: record });
    const plan = planLoad({
      current: store.read('current'),
      backup: store.read('backup'),
      gameId: 'line-siege',
    });
    expect(plan.outcome).toStrictEqual({ kind: 'restored-from-backup', reason: 'checksum' });
    store.quarantine('current', 'checksum', 1);
    expect(driver.get('SELECT COUNT(*) AS n FROM save_quarantine', [])).toStrictEqual({ n: 1 });
  });

  it('rolls back a failed transaction', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    const store = createSqliteSaveStore(driver);
    const record = encodeSaveDoc(createDefaultSaveDoc('line-siege'), META);
    store.write({ current: record });
    expect(() => {
      driver.transaction(() => {
        driver.run('UPDATE save_slots SET payload = ? WHERE slot = ?', ['x', 'current']);
        throw new Error('crash mid-write');
      });
    }).toThrow('crash mid-write');
    expect(store.read('current')?.payload).toBe(record.payload);
  });

  it('checkpoints the WAL into the main file', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    const store = createSqliteSaveStore(driver);
    store.write({ current: encodeSaveDoc(createDefaultSaveDoc('line-siege'), META) });
    store.checkpoint();
    expect(driver.get('PRAGMA wal_checkpoint(PASSIVE)', [])).toStrictEqual({
      busy: 0,
      log: 0,
      checkpointed: 0,
    });
  });
});
```

`load-plan.test.ts` (next to `load-plan.ts`, no SQL) covers every branch of section 6.7: fresh, loaded, restored with quarantine, newer version never writes, both damaged resets and quarantines both, and a save of another game treated as damaged. Coverage targets for `services/save` are 95/95/95/90 (FINAL D.39).

### 6.13 The simulator kill test

Jest proves the SQL; only killing the real app proves the whole write path (FINAL A.6, spec 15 item 6). The assertion tool reads the app's database from the host with the same codec:

```ts
// packages/tooling/src/save/inspect-save.ts
// Usage: node packages/tooling/src/save/inspect-save.ts <simulator-udid> <bundle-id> <game-id>
// Copies save.db (+ -wal, -shm) out of the simulator container and decodes both slots with
// the Shell's own codec. Read-only: the app's files are never opened in place.
// Exit code 1 when a slot is missing or does not decode, or save_quarantine has rows (the kill
// test's assertion).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { decodeSlot } from '@e07/shell/services/save/save-codec.ts';
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import { createNodeSqliteSqlDriver } from './node-sqlite-sql-driver.ts';

function copyDatabase(udid: string, bundleId: string): string {
  const args = ['simctl', 'get_app_container', udid, bundleId, 'data'];
  const container = execFileSync('xcrun', args, { encoding: 'utf8' }).trim();
  const source = join(container, 'Documents', 'SQLite', 'save.db');
  const target = join(mkdtempSync(join(tmpdir(), 'inspect-save-')), 'save.db');
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(source + suffix)) copyFileSync(source + suffix, target + suffix);
  }
  return target;
}

type Report = { readonly lines: readonly string[]; readonly isHealthy: boolean };

function inspect(path: string, gameId: string): Report {
  const driver = createNodeSqliteSqlDriver(path);
  const store = createSqliteSaveStore(driver);
  const slots = (['current', 'backup'] as const).map((slot) => {
    const record = store.read(slot);
    const result = record === null ? 'missing' : decodeSlot(record, gameId).kind;
    return { result, line: `${slot}: ${result} writeCount=${String(record?.writeCount ?? '-')}` };
  });
  const quarantined = driver.get('SELECT COUNT(*) AS n FROM save_quarantine', [])?.['n'];
  driver.close();
  const lines = [
    ...slots.map((slot) => slot.line),
    `quarantine rows: ${JSON.stringify(quarantined)}`,
  ];
  return { lines, isHealthy: slots.every((slot) => slot.result === 'ok') && quarantined === 0 };
}

const [udid, bundleId, gameId] = process.argv.slice(2);
if (udid === undefined || bundleId === undefined || gameId === undefined) {
  throw new Error('usage: inspect-save <udid> <bundle-id> <game-id>');
}
const report = inspect(copyDatabase(udid, bundleId), gameId);
process.stdout.write(`${report.lines.join('\n')}\n`);
process.exitCode = report.isHealthy ? 0 : 1;
```

The procedure (test variant Release build, a dedicated simulator per docs/14 rule 14):

```bash
# 1. dedicated simulator, test build installed (docs/14 build:ios:sim)
UDID=$(xcrun simctl create e07-kill-test 'iPhone 17' com.apple.CoreSimulator.SimRuntime.iOS-26-5)
xcrun simctl boot "$UDID" && xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app

# 2. boot-time kills: kill -9 at growing delays while startup writes run
for i in $(seq 1 12); do
  PID=$(xcrun simctl launch "$UDID" com.example.linesiege | awk '{print $2}')
  sleep "$(printf '0.%02d' $((i * 8)))"; kill -9 "$PID"   # 0.08 s, 0.16 s … 0.96 s
done
node packages/tooling/src/save/inspect-save.ts "$UDID" com.example.linesiege line-siege

# 3. mid-level kills: a Maestro flow (docs/07) plays N moves via the debug hooks, then
#    `xcrun simctl terminate` (FINAL A.6) or `kill -9`; relaunch; the flow asserts the
#    Game screen is back, paused, with moveCount >= N - 1, and inspect-save exits 0.

xcrun simctl shutdown "$UDID" && xcrun simctl delete "$UDID"
```

Shell scripts run by tooling may `sleep`; the agent's own foreground `sleep` may be blocked, in which case use a Node busy-wait or Maestro's waits. Pass criteria: `inspect-save` exits 0 after every batch (both slots decode and `save_quarantine` is empty), and no launch shows the S14 damaged-save dialog.

### 6.14 WAL checkpoint on background

```ts
// packages/shell/src/app/use-checkpoint-on-background.ts
import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { SaveService } from '@e07/shell/services/save/save-service.ts';

/**
 * Folds the WAL into save.db when the app leaves the foreground, so an iCloud/device
 * backup taken while the app is suspended holds one self-contained file (D5).
 */
export function useCheckpointOnBackground(save: SaveService): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') save.checkpoint();
    });
    return () => {
      subscription.remove();
    };
  }, [save]);
}
```

The game host's own background handler (docs/08) saves the paused run first; both listeners fire on the same transition and the checkpoint only folds what is already committed. Verified on the simulator: `save.db-wal` went from 4–16 KB in the foreground to 0 bytes after switching to another app.

---

## 7. Hydration at splash

### 7.1 The sequence

Everything up to the first render is synchronous; the native splash (docs/09) covers it.

| Step | Where | Writes? |
|---|---|---|
| 1. Intl polyfills | first import of `start-shell.ts` (docs/10) | no |
| 2. Peek the saved language | `peekCurrentSave()`: open `save.db`, read `current.payload`, `JSON.parse`, close; no validation | no |
| 3. Resolve language, plan direction | docs/10 `resolveLanguage`, `planDirection` + `createSqliteKvDirectionGuardAdapter()` | kv-store guard only |
| 4a. `restart`: register `StartupSplash`, which calls `restartForDirection` **after mounting** | `startup-splash.tsx` | no save write |
| 4b. `keep` / `give-up`: `createShellApp` | `create-shell-app.tsx` | |
| 5. Read runtime config | `readGameExtra()` (docs/02 section 9.2) | no |
| 6. Open the driver, error log, clock | adapters | no |
| 7. Read both slots → `planLoad` → `SaveService` → `applyLoadWrites` | `hydrate-save.ts` | **first save write** |
| 8. Validate the run with the game's parsers; drop only an invalid run | `createGameHost` (docs/02 section 7.4) | only if dropped |
| 9. Create the stores from `save.doc()` | `create-shell-app.tsx` | no |
| 10. Compute the resume `initialState` | `resumeState(doc)` | no |
| 11. `registerRootComponent(ShellRoot)`; first frame; the native splash hides | | |
| 12. After the first frame, never awaited: consent refresh, Premium re-check, connectivity, sound bank load | docs/11, docs/12, docs/09 | through their own paths |

### 7.2 The code

`packages/shell/src/app/start-shell.ts` belongs to docs/10 (section 3.10 has the complete file). It imports the Intl polyfills first, calls `peekCurrentSave()`, resolves the language, plans the direction with `createSqliteKvDirectionGuardAdapter()`, and then either registers `createStartupSplash(restart)` (`restart`) or calls `createShellApp` (`keep`, `give-up`). The reload runs from the mounted splash because calling `reloadAppAsync` during bundle evaluation crashed a Release build (see [Verified](#verified)).

```tsx
// packages/shell/src/app/startup-splash.tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ComponentType, JSX } from 'react';

const styles = StyleSheet.create({ splash: { flex: 1 } });

/**
 * Registered instead of the app when the layout direction must flip. The reload runs
 * AFTER this root has mounted: calling reloadAppAsync while the bundle is still being
 * evaluated crashed a Release build ("startSurface failed. Global was not installed").
 */
export function createStartupSplash(restart: () => Promise<void>): ComponentType {
  return function StartupSplash(): JSX.Element {
    useEffect(() => {
      restart().catch(() => undefined); // forceRTL is persisted: the next cold start applies it
    }, []);
    return <View style={styles.splash} testID="startup.splash" />;
  };
}
```

The splash view's background comes from the theme once docs/05's provider is available here; a flat view is enough because the native splash is still on screen for this frame.

```ts
// packages/shell/src/services/save/peek-current-save.ts
import { createExpoSqliteSqlDriver } from '@e07/shell/services/save/expo-sqlite-sql-driver.ts';
import { SAVE_DB_FILE, SELECT_SLOT_SQL } from '@e07/shell/services/save/save-db-schema.ts';

/**
 * docs/10's startup peek: the parsed `current` payload, or null. Read-only: no DDL, no
 * validation, no migration, no write (a direction reload may follow). Never throws.
 */
export function peekCurrentSave(): unknown {
  const driver = createExpoSqliteSqlDriver(SAVE_DB_FILE);
  try {
    const payload = driver.get(SELECT_SLOT_SQL, ['current'])?.['payload'];
    return typeof payload === 'string' ? (JSON.parse(payload) as unknown) : null;
  } catch {
    return null; // first launch (no table yet) or an unreadable row: the full load decides
  } finally {
    driver.close();
  }
}
```

If `current` is damaged but `backup` holds a different language, the peek falls back to the device language; the full load then restores the backup. If the restored language needs the other direction, the next cold start corrects it (docs/10's startup check repairs drift).

```tsx
// packages/shell/src/app/create-shell-app.tsx
import { hydrateSave } from '@e07/shell/app/hydrate-save.ts';
import { readAppVersion, readGameExtra } from '@e07/shell/app/read-game-extra.ts';
import { ShellApp } from '@e07/shell/app/shell-app.tsx';
import { createSystemClockAdapter } from '@e07/shell/services/clock/system-clock-adapter.ts';
import { createSqliteErrorLogAdapter } from '@e07/shell/services/error-log/sqlite-error-log-adapter.ts';
import { createExpoSqliteSqlDriver } from '@e07/shell/services/save/expo-sqlite-sql-driver.ts';
import { SAVE_DB_FILE } from '@e07/shell/services/save/save-db-schema.ts';
import { createPremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { createSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { DirectionPlan } from '@e07/shell/i18n/direction-plan.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';
import type { ComponentType, JSX } from 'react';

export type CreateShellAppInput<T extends ShellGameTypes> = {
  readonly game: ShellGameModule<T>;
  readonly language: Language;
  readonly directionPlan: Exclude<DirectionPlan, 'restart'>;
};

/**
 * The composition root (called by docs/10's startShell after the direction check):
 * adapters once, save hydrated synchronously, stores from the loaded document.
 */
export function createShellApp<T extends ShellGameTypes>(
  input: CreateShellAppInput<T>,
): ComponentType {
  const extra = readGameExtra();
  const driver = createExpoSqliteSqlDriver(SAVE_DB_FILE);
  const clock = createSystemClockAdapter();
  const errorLog = createSqliteErrorLogAdapter(driver, clock);
  const hydrated = hydrateSave({
    driver,
    clock,
    errorLog,
    gameId: extra.id,
    appVersion: readAppVersion(),
  });
  // After hydrateSave: on a first launch the error_log table exists only once the DDL has run.
  if (input.directionPlan === 'give-up') {
    errorLog.record('boot', new Error(`direction-restart-failed: ${input.language}`));
  }
  const stores = {
    settings: createSettingsStore(hydrated.save),
    premium: createPremiumStore(hydrated.save),
  };
  return function ShellRoot(): JSX.Element {
    return <ShellApp hydrated={hydrated} stores={stores} />;
  };
}
```

This is the minimal composition root that ran on the simulator. The full one also creates the remaining adapters (`Services`, docs/02 section 6.3), the progress and stats stores, the theme set (docs/05), the i18n provider (docs/10) and the game host (`createGameHost(game, save, BoardHost)`), each once, in the same function.

```ts
// packages/shell/src/app/hydrate-save.ts
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { lastWriteCount, planLoad } from '@e07/shell/services/save/load-plan.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { LoadOutcome } from '@e07/shell/services/save/load-plan.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { SqlDriver } from '@e07/shell/services/save/sql-driver.ts';
import type { InitialState } from '@react-navigation/native';

export type HydrateDeps = {
  readonly driver: SqlDriver;
  readonly clock: ClockPort;
  readonly errorLog: ErrorLogPort;
  readonly gameId: string;
  readonly appVersion: string;
};

export type Hydrated = {
  readonly save: SaveService;
  /** Drives the S14 dialog shown on the first screen (backup restored, newer save…). */
  readonly outcome: LoadOutcome;
  readonly initialState: InitialState | undefined;
};

/** Relaunch inside a level lands on Game (paused) above Home (spec S5). */
export function resumeState(doc: SaveDoc): InitialState | undefined {
  if (!doc.firstRun.tutorialDone || doc.run?.resumeOnLaunch !== true) return undefined;
  return { index: 1, routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }] };
}

/** S1 work, all synchronous: read both slots -> plan -> apply planned writes. */
export function hydrateSave(deps: HydrateDeps): Hydrated {
  const store = createSqliteSaveStore(deps.driver);
  const input = {
    current: store.read('current'),
    backup: store.read('backup'),
    gameId: deps.gameId,
  };
  const plan = planLoad(input);
  const { clock, errorLog, appVersion } = deps;
  const save = createSaveService(
    { store, clock, errorLog, appVersion, isStrict: TEST_ONLY !== null },
    plan,
    lastWriteCount(input),
  );
  save.applyLoadWrites();
  return { save, outcome: plan.outcome, initialState: resumeState(save.doc()) };
}
```

The system clock adapter, the only file that reads `Date`, is:

```ts
// packages/shell/src/services/clock/system-clock-adapter.ts
// The ONE file allowed to read Date (docs/04 CLOCK_ADAPTERS exemption).
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

function localDateKey(date: Date): DateKey {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

export function createSystemClockAdapter(): ClockPort {
  return {
    nowMs: () => Date.now(),
    today: () => localDateKey(new Date()),
  };
}
```

Test builds wrap it with an offset inside docs/14's test-only code, so the debug menu can "set the date" (S15).

---

## 8. Daily challenge and statistics data models

### 8.1 Date keys and the daily seed (game-kit, pure)

Days are local calendar dates as `'YYYY-MM-DD'` strings from `ClockPort.today()`. All arithmetic on them is integer math (no `Date`, determinism policy), so the same code runs in Jest, Hermes and tooling.

```ts
// packages/game-kit/src/dates/date-key.ts
// Pure calendar arithmetic on 'YYYY-MM-DD' keys: integer maths only, no Date (determinism policy).
// Algorithm: H. Hinnant, "chrono-Compatible Low-Level Date Algorithms" (days_from_civil).

/** Local calendar day, 'YYYY-MM-DD'. */
export type DateKey = string;

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

/** Days since 1970-01-01; NaN unless the key has the 'YYYY-MM-DD' shape (ranges: DATE_KEY). */
export function dayNumber(key: DateKey): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (match === null) return Number.NaN;
  const [, y, m, d] = match.map(Number);
  if (y === undefined || m === undefined || d === undefined) return Number.NaN;
  const year = m <= 2 ? y - 1 : y;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const dayOfYear = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** Inverse of dayNumber (civil_from_days). */
export function fromDayNumber(days: number): DateKey {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromDayNumber(dayNumber(key) + days);
}

/** b - a in whole days. */
export function daysBetween(a: DateKey, b: DateKey): number {
  return dayNumber(b) - dayNumber(a);
}
```

```ts
// packages/game-kit/src/dates/daily-seed.ts
import type { DateKey } from './date-key.ts';

/**
 * Spec 8.3: same local date + same game salt -> same uint32 seed on every phone.
 * FNV-1a over the key, mixed with the salt (Math.imul only). Goldens pin outputs:
 * changing this function breaks every player's daily streak comparison.
 */
export function dailySeed(date: DateKey, salt: number): number {
  let hash = (0x811c9dc5 ^ salt) >>> 0;
  for (let index = 0; index < date.length; index += 1) {
    hash = Math.imul(hash ^ date.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash;
}
```

```ts
// packages/game-kit/src/dates/date-key.test.ts
import fc from 'fast-check';

import { dailySeed } from './daily-seed.ts';
import { addDays, dayNumber, daysBetween, fromDayNumber } from './date-key.ts';

describe('date-key', () => {
  it('matches known day numbers', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('2026-09-26')).toBe(20_722);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('returns every day number between 1900 and 2400 after a round trip', () => {
    fc.assert(
      fc.property(fc.integer({ min: -25_567, max: 157_000 }), (days) => {
        expect(dayNumber(fromDayNumber(days))).toBe(days);
      }),
      { numRuns: 2000 },
    );
  });

  it('pins the daily seed (compatibility contract)', () => {
    expect(dailySeed('2026-09-26', 17)).toBe(2_599_028_541);
    expect(dailySeed('2026-09-27', 17)).toBe(2_582_250_922);
  });
});
```

The daily level is `engine.create(dailySeed(today, levels.daily.salt), levels.daily.difficulty)`. Its goldens (seed and the generated level for fixed dates) are a hard compatibility contract (spec 8.3; goldens per FINAL D.41, changes need the `Gate-Change:` trailer of D.42): changing either breaks "same level for every player" between app versions.

**Day boundaries.** "Today" is read, never cached: on every focus of Home, Daily and Game, and on every AppState change to `active`. A Daily run keeps the date it started with in `run.ref.date`, so finishing after midnight records the result under the day it was played.

### 8.2 The daily model (Shell, pure)

```ts
// packages/shell/src/stores/daily-model.ts
import { addDays, daysBetween } from '@e07/game-kit/dates/date-key.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type DailySection = SaveDoc['daily'];
export type DailyResult = DailySection['results'][string];

const KEEP_DAYS = 60;

function nextStreak(streak: DailySection['streak'], date: DateKey): DailySection['streak'] {
  if (streak.lastDate === null) return { lastDate: date, length: 1 };
  const gap = daysBetween(streak.lastDate, date);
  if (gap === 1) return { lastDate: date, length: streak.length + 1 };
  if (gap > 1) return { lastDate: date, length: 1 };
  return streak; // same day or the clock went backwards: never double-count (spec S9)
}

function pruned(results: DailySection['results'], newest: DateKey): DailySection['results'] {
  return Object.fromEntries(
    Object.entries(results).filter(([date]) => daysBetween(date, newest) < KEEP_DAYS),
  );
}

/** Spec S9: the FIRST finished attempt of `date` counts; replays change nothing. */
export function recordDailyResult(
  daily: DailySection,
  date: DateKey,
  result: DailyResult,
): DailySection {
  if (date in daily.results) return daily;
  const streak = nextStreak(daily.streak, date);
  const newest = streak.lastDate ?? date;
  return {
    results: pruned({ ...daily.results, [date]: result }, newest),
    streak,
    bestStreak: Math.max(daily.bestStreak, streak.length),
  };
}

/** "Played yesterday or today" (spec S9): the streak survives until the end of tomorrow. */
export function currentDailyStreak(daily: DailySection, today: DateKey): number {
  if (daily.streak.lastDate === null) return 0;
  const gap = daysBetween(daily.streak.lastDate, today);
  return gap === 0 || gap === 1 ? daily.streak.length : 0;
}

export function isDailyDone(daily: DailySection, today: DateKey): boolean {
  return today in daily.results;
}

/** Oldest first. The strip is laid out with flexDirection 'row', so RTL mirrors it. */
export function lastSevenDays(
  daily: DailySection,
  today: DateKey,
): readonly { readonly date: DateKey; readonly isDone: boolean }[] {
  return [6, 5, 4, 3, 2, 1, 0].map((back) => {
    const date = addDays(today, -back);
    return { date, isDone: date in daily.results };
  });
}
```

Decisions inside the spec's rules:

- **"Completion" is the first finished attempt, won or lost.** Spec S9 counts "played yesterday or today" for streaks, and a lost daily still ends the day's attempt ("replays don't change the day's result"). S10's "challenges completed" is the number of recorded days; the Daily card can also show how many were won (`won`).
- **The streak is stored incrementally** (`lastDate`, `length`), so results can be pruned to 60 days without shortening a 400-day streak.
- **Clock backwards:** a date already recorded stays done; a new earlier date is recorded but leaves the streak untouched; nothing throws and nothing is counted twice.
- **No archive:** past days cannot be replayed for the streak (spec 8.3); a result for a date other than the run's own `ref.date` is never recorded.

```ts
// packages/shell/src/stores/daily-model.test.ts
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { currentDailyStreak, isDailyDone, recordDailyResult } from './daily-model.ts';

const EMPTY = createDefaultSaveDoc('line-siege').daily;
const WIN = { won: true, score: 120, moves: 9, playMs: 60_000 };

describe('daily-model', () => {
  it('counts consecutive days and keeps the best streak', () => {
    const days = ['2026-09-24', '2026-09-25', '2026-09-26'];
    const daily = days.reduce((acc, date) => recordDailyResult(acc, date, WIN), EMPTY);
    expect(currentDailyStreak(daily, '2026-09-27')).toBe(3);
    expect(currentDailyStreak(daily, '2026-09-28')).toBe(0);
    expect(daily.bestStreak).toBe(3);
  });

  it('keeps the first result of a day', () => {
    const first = recordDailyResult(EMPTY, '2026-09-26', WIN);
    expect(recordDailyResult(first, '2026-09-26', { ...WIN, score: 999 })).toBe(first);
  });

  it('keeps the streak unchanged when the clock goes backwards', () => {
    const later = recordDailyResult(EMPTY, '2026-09-26', WIN);
    const earlier = recordDailyResult(later, '2026-09-20', WIN);
    expect(earlier.streak).toStrictEqual(later.streak);
    expect(isDailyDone(earlier, '2026-09-26')).toBe(true);
  });
});
```

### 8.3 The statistics model

Stored numbers are only those that cannot be derived. S10's cards map to data like this:

| S10 number | Source |
|---|---|
| games played, wins, win rate, total play time | `stats.gamesPlayed`, `stats.wins`, `wins / gamesPlayed`, `stats.playMs` |
| levels completed, stars earned / total, 3-star levels | derived from `progress.levels` and `levels.table` |
| best score per mode | `stats.bestScore.{level,daily,endless}` (endless also `progress.endlessBest`) |
| best level result | derived: highest level completed and its stars |
| longest win streak | `stats.longestWinStreak` |
| daily completed, current streak, best streak | derived from `daily` (`results` count, `currentDailyStreak`, `bestStreak`) |
| last 7 days bar chart | `stats.days` (pruned to 14 days) |
| game-specific counters | `stats.counters` by `CounterSpec.id` |

```ts
// packages/shell/src/stores/stats-model.ts
import { daysBetween } from '@e07/game-kit/dates/date-key.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type StatsSection = SaveDoc['stats'];

/** Summary of one finished (won or lost) non-tutorial run. */
export type FinishedRun = {
  readonly mode: 'level' | 'daily' | 'endless';
  readonly isWon: boolean;
  readonly score: number;
  readonly playMs: number;
  /** CounterSpec.id -> value measured over this run's final move line. */
  readonly counters: Readonly<
    Record<string, { readonly value: number; readonly aggregate: 'sum' | 'max' }>
  >;
};

const KEEP_DAYS = 14;

function foldCounters(
  current: StatsSection['counters'],
  run: FinishedRun,
): StatsSection['counters'] {
  const next: Record<string, number> = { ...current };
  for (const [id, { value, aggregate }] of Object.entries(run.counters)) {
    const previous = next[id] ?? 0;
    next[id] = aggregate === 'sum' ? previous + value : Math.max(previous, value);
  }
  return next;
}

function addDay(days: StatsSection['days'], today: DateKey, playMs: number): StatsSection['days'] {
  const day = days[today] ?? { games: 0, playMs: 0 };
  const merged = { ...days, [today]: { games: day.games + 1, playMs: day.playMs + playMs } };
  return Object.fromEntries(
    Object.entries(merged).filter(([date]) => daysBetween(date, today) < KEEP_DAYS),
  );
}

/** Written in the SAME save.update as the level result, before S7 appears. */
export function recordFinishedRun(
  stats: StatsSection,
  run: FinishedRun,
  today: DateKey,
): StatsSection {
  const currentWinStreak = run.isWon ? stats.currentWinStreak + 1 : 0;
  return {
    ...stats,
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + (run.isWon ? 1 : 0),
    losses: stats.losses + (run.isWon ? 0 : 1),
    playMs: stats.playMs + run.playMs,
    bestScore: { ...stats.bestScore, [run.mode]: Math.max(stats.bestScore[run.mode], run.score) },
    currentWinStreak,
    longestWinStreak: Math.max(stats.longestWinStreak, currentWinStreak),
    days: addDay(stats.days, today, run.playMs),
    counters: foldCounters(stats.counters, run),
  };
}
```

- **Counters are measured at run end** by replaying the run's final move line and calling each `CounterSpec.measure` on each move's events (docs/02 section 7.2): undone moves do not count, and a kill mid-run loses nothing because the log is saved.
- **The tutorial is not a game** for statistics.
- **Empty state** (S10: "Play a level to see your stats here") is `gamesPlayed === 0`.
- **"Reset statistics"** clears only `stats`; the Levels and Daily cards are derived from `progress` and `daily`, which only "Reset all progress" clears (see Open issues).

---

## Checklist

- [ ] The navigator has exactly the routes of section 3.1; `navigate` calls type-check; the debug group is absent from a store export (sentinel grep).
- [ ] Game screen: `gestureEnabled: false`; Back while playing opens Pause, Back in Pause resumes, Home leaves via the ref + dispatch; a won or lost run leaves normally.
- [ ] `direction` is `readLayoutDirection()`; no screen reads the language to decide layout direction.
- [ ] Every store: factory from `save.doc()`, pure reducer with imperative kebab-case actions, reduce → `save.update` → `set`; selectors return primitives or use `useShallow`.
- [ ] `gameSessionReducer` tests (undo limits, continue once, paused ignores moves) and the game's undo/replay properties pass.
- [ ] Every write goes through `SaveService.update`; per-move writes do not refresh the backup; run end, resets and Premium do.
- [ ] Save schema: no edit to a shipped `save-doc-vN.ts`; a new version has its migration, fixtures, checksums, step test and property test; `Gate-Change:` trailer present.
- [ ] `load-plan.test.ts`, `save-fixtures.test.ts`, `reset-progress.test.ts` and `test/integration/save/*.test.ts` pass; coverage of `services/save` ≥ 95/95/95/90.
- [ ] Kill test: `inspect-save` exits 0 after every batch; no quarantine rows; relaunch lands on the paused Game with the right move count.
- [ ] `save.db-wal` is 0 bytes after sending the app to the background.
- [ ] Boot writes nothing before the direction check; a direction flip reloads from the mounted splash (no crash in a Release build).
- [ ] Daily: first attempt only, streak "yesterday or today", clock-back safe, seeds pinned by goldens.

---

## Sources

- React Navigation static configuration: https://reactnavigation.org/docs/static-configuration
- React Navigation TypeScript (static API): https://reactnavigation.org/docs/typescript
- usePreventRemove: https://reactnavigation.org/docs/use-prevent-remove
- NavigationContainer `direction`, `initialState`: https://reactnavigation.org/docs/navigation-container
- Upgrading from 6.x (`navigate` no longer goes back; `popTo`): https://reactnavigation.org/docs/upgrading-from-6.x
- Zustand (vanilla stores, `useStore`): https://github.com/pmndrs/zustand
- Zustand v5 migration (`useShallow`): https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md
- expo-sqlite (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- expo-sqlite kv-store: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/#key-value-storage
- `reloadAppAsync`: https://docs.expo.dev/versions/latest/sdk/expo/#reloadappasyncreason
- SQLite WAL: https://www.sqlite.org/wal.html
- SQLite PRAGMA (`synchronous`, `journal_mode`, `wal_checkpoint`, `user_version`): https://www.sqlite.org/pragma.html
- SQLite STRICT tables: https://www.sqlite.org/stricttables.html
- SQLite UPSERT: https://www.sqlite.org/lang_upsert.html
- Node.js `node:sqlite`: https://nodejs.org/api/sqlite.html
- valibot: https://valibot.dev/ and https://www.npmjs.com/package/valibot
- zod (JIT `new Function`, `jitless`): https://zod.dev/ and the published package source `zod/v4/core/schemas.js`
- FNV hash: http://www.isthe.com/chongo/tech/comp/fnv/
- H. Hinnant, date algorithms: https://howardhinnant.github.io/date_algorithms.html
- fast-check: https://fast-check.dev/
- Apple, iCloud backup of app data: https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup

---

## Verified

On 2026-09-26, in the canonical-layout monorepo harness (`scratchpad/rn/writer-arch-nav/ws`), with Node 26.4.0 (SQLite 3.53.2), npm 11.17.0, Xcode 26.6, the iOS 26.5 simulator (a dedicated iPhone 17 created and deleted by the run), expo 57.0.25, react-native 0.86.3 (Hermes V1), react 19.2.3, @react-navigation/native 7.4.1 + native-stack 7.19.2 (core 7.22.1), react-native-screens 4.26.2, expo-sqlite 57.0.3 (bundled SQLite 3.50.3), expo-constants 57.0.19, zustand 5.0.15, valibot 1.5.0, TypeScript 6.0.3, ESLint 9.39.5 with docs/04's config, Jest 29.7.0 + jest-expo 57.0.5, fast-check 4.10.2:

- **Types.** The navigator, typed params and global augmentation compiled; a wrong route name and a wrong `Game` param were rejected by `tsc`.
- **Tests.** 31 Jest tests passed: session reducer, load plan (6 branches), fixtures (frozen checksums, decode, round trip), reset, settings store, daily model, date keys (2,000-run property, pinned seeds), and the SQL integration file on `node:sqlite` inside jest-expo's environment (WAL, `synchronous` = 2, reload, backup restore + quarantine, rollback, checkpoint).
- **Lint.** Every code block passed docs/04's `eslint.config.mjs` and Prettier.
- **Reviewer re-run (2026-09-26, `scratchpad/rn/verify-architecture-state/ws`).** Every code block of this doc and docs/02 extracted verbatim into a copy of the harness with docs/04's current `tsconfig` files and `eslint.config.mjs` (plus docs/02's app zones), docs/14's `src/app/test-only.ts` and docs/10's `sqlite-kv-direction-guard-adapter.ts`: `tsc` passes for the root, game-kit, shell, tooling and app programs; ESLint `--max-warnings 0` and Prettier pass; Jest 9 suites / 31 tests pass. Library facts re-read in the installed sources: `withTransactionSync` (expo-sqlite 57.0.3 `SQLiteDatabase.js`), bundled SQLite 3.50.3 (`vendor/sqlite3/sqlite3.h`), `NavigationContainer`'s `direction` default, `StackRouter`'s `NAVIGATE` (pushes unless `pop: true`), `usePreventRemove` re-dispatch (`VISITED_ROUTE_KEYS`), zustand's `shallow.d.ts`, zod 4.6.5's `allowsEval` JIT probe, valibot 1.5.0 (MIT, no dependencies, no `new Function`, published 2026-09-09).
- **Release build on the simulator.** First launch: fresh document validated by valibot on Hermes and written to both slots (`writeCount` 1, WAL). Relaunch: decoded, validated, backup refreshed (2). With the saved language set to `fa` from the host: exactly one write after the reload (11), app alive, `RCTI18nUtil_forceRTL = true`; back to `en`: one write (21), zero JS exceptions in the log. App to background: `save.db-wal` 4–16 KB → 0 bytes. Ten and twelve `kill -9` at growing delays during startup writes: both slots always decoded, no quarantine rows.
- **Why the reload runs from the splash.** With the earlier ordering (`registerRootComponent` then `void reloadAppAsync(...)` during bundle evaluation), the Release app terminated: "Unhandled JS Exception: [runtime not ready]: Error: Non-js exception: AppRegistryBinding::startSurface failed. Global was not installed." With the reload moved into the mounted splash's effect, both flips succeeded.
- **Variants.** Store exports never contained the debug screen; test exports did (docs/14's gate, docs/14's cache key).
- **Integration pass (2026-09-26, `scratchpad/integ/ws`, a copy of the reviewer's workspace).** `create-shell-app.tsx` now logs the direction give-up as `'boot'` (docs/04 added the value); the Shell program still passes `tsc`, ESLint and Prettier, and Jest ran 10 suites / 32 tests (with docs/15's rewritten save perf test).
- **Premium store in `ShellStores` (2026-09-26, `scratchpad/fix-final/ws06`, a copy of `integ/ws`).** With docs/12's `premium-store.ts` and the updated `stores-context.tsx` and `create-shell-app.tsx` above, `tsc -p packages/shell` passes, docs/04's merged ESLint lints the workspace clean (176 files) and Jest passes (10 suites, 32 tests). `settings-store.test.ts` and docs/07's `renderWithShell` tests pass on the same files in `scratchpad/fix-final/repo`, where `fake-save-store.ts` (printed in section 6.5 from that workspace, unchanged) passes `tsc`, ESLint and Prettier.
- **Re-verify** when versions age: `npm view valibot version time --json` (7-day rule, docs/01), `npx expo install --check`, then `npx jest test/integration/save packages/shell/src/services/save`, the kill test, and one direction flip on a Release simulator build.

---

## Open issues

1. **Resolved: save-test names in other docs.** docs/07 section 3.8.5 now points to this doc's files, and docs/15's save perf test uses `createNodeSqliteSqlDriver`, `createSqliteSaveStore(driver)`, `encodeSaveDoc` and `SaveStore.write({ current })` (re-run in the integration pass on 2026-09-26).
2. **Resolved: docs/05's theme and reduce-motion hooks** now read `selectThemePreference`, `selectReduceMotionPreference` and `state.settings.colorBlind` (type-checked against this doc's store in the integration pass).
3. **Resolved: docs/01's versions table has the `valibot` 1.5.0 row** and its open issue 4 is closed.
4. **Spec gap: both slots damaged.** S14 defines only "a backup copy was restored". This doc shows "Your progress couldn't be loaded." and starts fresh (the bad rows are quarantined, not deleted). The text needs a catalog key and a translation pass.
5. **Spec ambiguity: "Reset statistics" vs derived cards.** Levels completed, stars and daily streaks are derived from progress and daily results, so "Reset statistics" leaves them; only "Reset all progress" clears them. If the owner expects the Stats screen to show all zeros after "Reset statistics", the Levels and Daily cards need their own reset baselines.
6. **Daily "completion" includes a lost attempt** (first finished attempt counts for the streak). If the owner wants only wins to count, change `recordDailyResult`'s caller, not the model.
7. **Resolved: `ErrorSource` has a `'boot'` value** (docs/04 section 6.2); `createShellApp` logs docs/10's `direction-restart-failed` with it.
8. **Transition direction with `headerShown: false`** was not checked visually. The source supports it: native-stack always passes `direction` in the header config (with `hidden: true`), and react-native-screens 4.26 applies it to the navigation controller's view (`applySemanticContentAttributeIfNeededToNavCtrl`) before its hidden-bar early return; UIKit takes push/pop direction from that attribute. The owner's RTL play-test should still confirm that pushes slide from the reading direction.
9. **Back on the Game screen was checked by `tsc` and by reading React Navigation's source, not at runtime.** Add an RNTL test with the real static navigator: `navigation.goBack()` while playing shows Pause, a second `goBack()` resumes, and Pause → Home lands on `Home` with the run saved (`resumeOnLaunch: false`).
10. **Reduce-motion transitions.** docs/15 rule 28 asks for fade transitions when Reduce motion is on. The static navigator above always uses the platform push animation; the Shell still has to set `animation: 'fade'` on the native stack from `useReduceMotion()` (docs/05 section 3.13), for example through `navigation.setOptions` in each screen's model hook or a screen-options function that reads the settings store. Not designed or verified yet.
11. **A newer database structure crashes at boot.** `createSqliteSaveStore` throws when `save.db`'s `PRAGMA user_version` is newer than the app knows (only a downgrade, for example an older TestFlight build, can cause it). Spec 8.14 forbids a crash loop, so this should be handled like the `newer-version` load outcome: open read-only, play in memory, show the S14 "please update" dialog.
