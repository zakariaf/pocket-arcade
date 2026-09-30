# Routes, groups and flows

The product's screen map, what is a route and what is not, and how the app moves between screens. Everything here is decided; the navigator in `templates/root-stack.tsx` is its code.

## Contents

- The screen map (product rules)
- The route table
- What is not a route, and where it renders
- Groups and their if-hooks
- Flows
- Where each screen navigates to
- Direction and transitions
- The Game screen's Back rule
- A partial Shell (shell-slice.json)

## The screen map (product rules)

```
S1 Splash
S2 First-run language choice          (first launch only)
 --> S13 Tutorial level                (first launch only)
S3 Ad consent                          (only where legally required; before the first ad)
S4 Home
   |-- S5  Game screen
   |     |-- S6 Pause menu
   |     |-- S7 Result screen (win / lose)
   |-- S8  Levels
   |-- S9  Daily challenge
   |-- S10 Statistics
   |-- S11 Settings
   |     |-- S11a Language
   |     |-- S11b About and credits
   |     |-- S11c Privacy policy (offline text)
   |     |-- S11d Licences
   |-- S12 Premium (the purchase page)
   |-- S13 How to play (and tutorial replay)
S14 Dialogs (confirmations, store states, errors)
S15 Debug menu (test builds only)
```

Navigation rules from the product spec:

- Home is the root. Every other screen has a Back control. In right-to-left languages the Back arrow points right.
- The system back gesture or button always does the same as Back.
- On the Game screen, Back opens the Pause menu instead of leaving, so a stray swipe never loses a run.
- Maximum depth from Home: 2 screens (for example Settings > Language).
- Transitions slide in the reading direction and mirror in RTL.
- S1: under 1 second, never waits for the network, loads save, settings and language, then goes to S2 on first launch, otherwise straight to Home. No ad on launch, ever.
- S2: after Continue, the first launch goes to the tutorial level (S13), not to Home.
- S3: never before the tutorial level is finished; before the first ad request; only where required; offline or Premium skips it.

## The route table

One React Navigation 7 static native stack. Route names are PascalCase; params are listed where they exist.

| Spec | Route | Group | Params | Notes |
|---|---|---|---|---|
| S1 Splash | none | | | native splash while the Shell hydrates synchronously |
| S2 First-run language | `LanguageChoice` | FirstRun | none | shown until a language is chosen (`if: useNeedsLanguageChoice`) |
| S13 Tutorial level | `Tutorial` | FirstRun | none | the Game screen body in tutorial mode; `gestureEnabled: false`. "Play the tutorial again" (S13 How to play) opens `Game` with `{ start: 'new', ref: { kind: 'tutorial' } }`, because FirstRun is gone after the first run |
| S3 Ad consent | none | | | Google's UMP form, presented by the consent port |
| S4 Home | `Home` | Main | none | root of the main app: the first Main screen |
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
| S14 Dialogs | none | | | dialog host above the navigator |
| S15 Debug | `Debug` | Debug | none | test builds only |
| S15 Font test page | `FontTest` | Debug | none | test builds only; opened from S15's Font test row; every Toybox type role in en, de, fa and ckb |

Depth from Home never exceeds 2: every Main route is pushed from Home or from one depth-1 screen (Settings pushes the four S11 sub-screens, About pushes Licences, Game pushes How to play from Pause and Premium from Result). A finished run leaves Game with `popTo`, so a stack never grows past `[Home, x, y]`.

`GameParams` (`templates/route-params.ts`): `{ start: 'resume' }` or `{ start: 'new', ref: RunRef }`, where `RunRef` is the save document's run reference (`{ kind: 'level', level }`, `{ kind: 'daily', date }`, `{ kind: 'endless' }`, `{ kind: 'tutorial' }`). Params stay small and serialisable; screens read everything else from the stores.

## What is not a route, and where it renders

| Screen | Why not a route | Where it renders |
|---|---|---|
| S1 Splash | the native splash covers hydration; a JS splash is shown only during a direction restart | the native splash; `app/startup-splash.tsx` for the restart case |
| S3 Consent | Google draws the form; the Shell decides when | the consent port, called from Home after the tutorial |
| S6 Pause, S7 Result | the board must stay mounted and paused; a route change would unmount it | overlays inside `screens/game/game-screen.tsx` |
| S14 Dialogs | they sit above whatever screen is showing | the dialog host above the navigator |

## Groups and their if-hooks

| Group | `if` hook (route-guards.ts) | True when | Screens |
|---|---|---|---|
| FirstRun | `useIsFirstRun` | `!firstRun.tutorialDone` | `LanguageChoice` (own `if: useNeedsLanguageChoice`: `!firstRun.languageChosen`), `Tutorial` |
| Main | `useIsMainApp` | `firstRun.tutorialDone` | `Home` first, then the rest |
| Debug | `useIsTestBuild` | `TEST_ONLY !== null` (test builds) | `Debug`, `FontTest` |

Groups switch by their if-hooks, never by `navigate`: a hook reads the settings store, the store changes, the navigator re-renders with the new set of screens, and React Navigation lands on the first screen that exists. Group order matters for exactly that reason. The debug screen's code must be absent from store bundles; `TEST_ONLY` (a literal `process.env.EXPO_PUBLIC_APP_VARIANT === 'store'` comparison around a `require`) makes Metro drop it, and `TEST_ONLY !== null` may drive behaviour (the group's `if`) but never inclusion.

## Flows

**First launch.** `LanguageChoice` (S2) dispatches `set-language` (which also sets `firstRun.languageChosen`). If the direction flips (English to Persian or Sorani, or back), the i18n layer's `restartForDirection` runs on the same Continue tap; after the reload `LanguageChoice`'s `if` is false and the FirstRun group opens `Tutorial`. The tutorial's last step dispatches `finish-tutorial`; `useIsFirstRun` turns false, the navigator re-renders with the Main group only, and React Navigation lands on `Home`. Home then prepares ads, which shows S3 where required.

**The Tutorial route.** `screens/first-run/tutorial-screen.tsx` exports `TutorialScreen` (root-stack imports it; game-host-integration ships it with its `use-tutorial-model.ts`; it is part of every Shell app, so the route points at it even in a partial Shell without S13). It is the Game screen body opened with `{ start: 'new', ref: { kind: 'tutorial' } }` (the game host's scripted teaching run), its root carries `testID="tutorial.screen"` and its Skip control `tutorial.skip-button` (the map's Chosen ids; Skip appears from the second step, spec S13). Back never leaves it (`gestureEnabled: false`, the same prevent-remove rule as Game); its Pause has no Home button (Chosen: the FirstRun group has no Home to go back to). Finishing the last step or Skip dispatches `finish-tutorial`; the groups then switch to Main and React Navigation lands on Home. Never `navigate('Home')` from it.

**Relaunch inside a level.** If the saved run has `resumeOnLaunch: true`, hydration returns `initialState = { index: 1, routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }] }`; the Game screen restores the session paused (spec S5: "lands back here in the exact same state"). Otherwise S1 goes straight to Home.

**Settings → Language.** The text switches at once; a direction change shows the S14 "Restart to apply" dialog (the i18n layer owns the restart).

**Play the tutorial again** (S13 How to play): `navigation.navigate('Game', { start: 'new', ref: { kind: 'tutorial' } })`.

**Result → next.** Next level: the game host starts the next run inside the same Game screen (no navigation). Levels: `navigation.dispatch(StackActions.popTo('Levels'))` after the host has saved the run: if Levels is under Game it goes back to it, otherwise popTo replaces Game with Levels (React Navigation 7 `POP_TO`, read in the installed StackRouter), so no finished Game stays in the stack. Home: `navigation.dispatch(StackActions.popTo('Home'))`.

## Where each screen navigates to

| From | Action | Call |
|---|---|---|
| any top bar | Back | `navigation.goBack()` |
| Home | Play / Continue | `navigate('Game', { start: 'resume' })` when a run is saved, else `navigate('Game', { start: 'new', ref })` |
| Home | Daily card play | `navigate('Game', { start: 'new', ref: { kind: 'daily', date } })` |
| Home | Endless card | `navigate('Game', { start: 'new', ref: { kind: 'endless' } })` |
| Home | Levels / Statistics / How to play / Premium / settings gear | `navigate('Levels')`, `navigate('Stats')`, `navigate('HowToPlay')`, `navigate('Premium')`, `navigate('Settings')` |
| Home | Daily card title | `navigate('Daily')` |
| Levels | tap an unlocked tile | `navigate('Game', { start: 'new', ref: { kind: 'level', level } })` |
| Daily | Play | `navigate('Game', { start: 'new', ref: { kind: 'daily', date } })` |
| Stats (empty) | Play a level | `navigate('Game', …)` as Home's Play |
| Settings | Language / About / Privacy policy / Licences / Remove ads | `navigate('SettingsLanguage')`, `navigate('About')`, `navigate('PrivacyPolicy')`, `navigate('Licences')`, `navigate('Premium')` |
| About | Licences | `navigate('Licences')` |
| Pause | How to play | `navigate('HowToPlay')` (the run stays paused underneath) |
| Pause | Home | set the leaving ref, then `dispatch(StackActions.popTo('Home'))` |
| Result | Levels | `dispatch(StackActions.popTo('Levels'))` (back to Levels, or replaces Game with it) |
| Result | Premium nudge | `navigate('Premium')` |
| S15 (test builds) | from a debug link or the Settings footer tap | `navigate('Debug')`; its Font test row `navigate('FontTest')` |

Navigation calls live in screens and their `use-<screen>-model.ts` hooks, never in `ui/` components (those receive `onPress` callbacks). Name local handlers `handleX` and callback props `onX`.

## Direction and transitions

- The container gets `direction={readLayoutDirection()}` (the `I18nManager` value, read only in `i18n/direction.ts`). React Navigation's own default is `I18nManager.getConstants().isRTL`; passing it makes the shared source explicit. Never pass the language setting: during the one launch before a direction reload the language already says RTL while the layout is still LTR.
- Native stack hands the direction to react-native-screens, which sets the navigation controller's semantic content attribute; UIKit then slides pushes in from the reading direction. This holds with `headerShown: false` (read in react-native-screens 4.26 source); confirm it once in the owner's RTL play-test.
- Reduce motion (the Shell setting, which defaults to the phone's): pushes cross-fade (`animation: 'fade'`) instead of sliding. `templates/navigation-root.tsx` wraps `rootStack` with `.with(...)` so the options can read `useReduceMotion()`; verified at runtime in Jest.

## The Game screen's Back rule

- `gestureEnabled: false` (and `fullScreenGestureEnabled: false`) on `Game` and `Tutorial`: the iOS edge swipe is off.
- `usePreventRemove(isRunLive, …)` while the run is `playing` or `paused`: Back while playing opens Pause; Back in Pause resumes.
- Leaving is only the Pause "Home" button: it sets `isLeavingRef`, saves the run with `resumeOnLaunch: false` (`controls.leaveToHome()`), then dispatches `popTo('Home')`; the prevent-remove callback sees the ref and re-dispatches the intercepted action.
- A won or lost run is not live, so Back from the Result overlay leaves normally.
- The app going to the background pauses the session (the game host's lifecycle hook), so a return shows Pause.
- `usePreventRemove` cannot see app kills: the save after every move is the real guarantee.

## A partial Shell (shell-slice.json)

A repo may build the Shell in slices. `shell-slice.json` at the repo root lists the screens that exist, for example `{ "screens": ["S4", "S11", "S12"], "why": "Home + Settings parity slice" }` (ids S1-S15, S11a-S11d; `[]` for a game-first repo without a Shell app). The route table above never shrinks:

| Route | Screen id | Outside the slice it points at |
|---|---|---|
| `LanguageChoice` | S2 | `NotBuiltScreen`, whose Next dispatches `set-language` (null), so a first launch moves on to the tutorial |
| `Tutorial` | (Shell core) | never a stand-in: always `TutorialScreen` (game-host-integration), whose last step dispatches `finish-tutorial` |
| `Home` | S4 | `NotBuiltScreen` (a slice without Home is unusual but valid) |
| `Game` | S5 | `NotBuiltScreen<GameParams>` (keeps the params type; keep `gestureEnabled: false`) |
| `Levels`, `Daily`, `Stats` | S8, S9, S10 | `NotBuiltScreen` |
| `Settings`, `SettingsLanguage`, `About`, `PrivacyPolicy`, `Licences` | S11, S11a, S11b, S11c, S11d | `NotBuiltScreen` |
| `Premium`, `HowToPlay` | S12, S13 | `NotBuiltScreen` |
| `Debug`, `FontTest` | S15 | `NotBuiltScreen` in place of `DebugRoute` and `FontTestRoute` (the test-only pair then leaves out `DebugScreen` and `FontTestScreen`) |

Every call in "Where each screen navigates to" stays exactly as written: a Home key whose screen is not built opens the stand-in, never a no-op. S6 Pause and S7 Result are overlays, so they have no route; they are built with S5. A slice never ships: `check-navigation.mjs . --complete` (and the release checks) fail while `shell-slice.json` exists or any route uses `NotBuiltScreen`.
