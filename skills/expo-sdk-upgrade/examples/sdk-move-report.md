# Example: the owner messages around an SDK move

Three short messages in plain words: the weekly "not yet", the "ready to start", and the finished move. The owner never reads code; lead with what it means for the games, then at most one request, then the evidence.

## 1. Not yet (the check at a session start)

Command and result:

```text
$ node ${CLAUDE_SKILL_DIR}/scripts/check-sdk-trigger.mjs . --online
sdk      apps on Expo SDK 57; target SDK 58; npm latest 57.0.26, next 58.0.0
wait     [target-stable] SDK 58 is not stable yet: expo "latest" is 57.0.26 (next: 58.0.0); betas, previews and "next" releases are never adopted
verdict  no upgrade due: stay on SDK 57; check again at the next session start
check-sdk-trigger: 2 trigger conditions and packages checked, 0 problems
RESULT: PASS
```

`RESULT: PASS` here means "no move is due": staying is the correct, finished outcome (exit 0). A younger release prints its day instead, for example `wait     [target-age] expo 58.0.2 was published 2026-10-30; it is not 7 days old on 2026-11-02 ...; possible from 2026-11-07`.

Message (only when the owner asked, or once a month):

> The games stay on the current Expo version (SDK 57). The next one (SDK 58) is out as a pre-release but not yet Expo's main release; it becomes eligible 7 days after it is, which Expo expects in October. Nothing for you to do.

## 2. Ready to start

When `check-sdk-trigger.mjs` reports `FAIL [upgrade-due]` (the move is due and not yet done; its `plan` lines follow):

> Expo SDK 58 has been stable for more than a week and every part the games use is out and old enough. I will move all 26 games to it together on a separate branch: new React Native, new gesture and animation libraries, one test-setup change. Nothing reaches the main line until every check, simulator build, end-to-end run and screenshot comparison is green and you have seen the result. If you would rather wait, tell me; otherwise I start with the next session.

## 3. Finished move (before merging)

> All 26 games now run on Expo SDK 58 on the branch `chore/expo-sdk-58`; players will see no difference. Every check passed: the full test suite, 26 simulator builds that launched, the end-to-end flows, and the screenshot comparison (4 languages, light and dark, phone and tablet).
>
> One request: may I merge the branch into the main line? Default: I merge at the start of the next session if you have not objected.
>
> What to look at, if you want: the board screenshots in `reports/screenshots/index.html` changed slightly (anti-aliasing from the new drawing library); I compared each one and accepted 12 of them.
>
> Not verified: TestFlight builds on a real iPhone (that is the next release's first step).

Evidence kept under `reports/` for the record: `sdk-trigger.json` (the npm facts of the `upgrade-due` run), the `check-sdk-alignment.mjs` output (`RESULT: PASS`), the trigger check after the move (`RESULT: PASS`: no move due), `expo-doctor` per app (20/20 checks), `npm ls react react-native react-native-reanimated react-native-worklets` (one version each), the `npm run verify` log, the simulator and E2E logs, and the screenshot diff summary.

## The move commit

```text
build(deps): move every app to Expo SDK 58

expo ~58.0.2, react-native 0.88.2, react 19.3.0, Reanimated 4.7.0,
Worklets 0.13.0, Gesture Handler ~3.2.1, Skia 2.11.2 in all 26 apps;
jest-expo, eslint-config-expo, @react-native/*, @types/react and
test-renderer follow; root overrides pin one copy of each native core.
Board gestures use the Gesture Handler 3 hooks; config plugins import
expo/config-plugins; Jest uses the Reanimated resolver. verify,
simulator builds, E2E and the screenshot matrix pass for every app;
12 board goldens re-accepted after review (Skia 2.11 anti-aliasing).

Gate-Change: Jest resolver and re-accepted goldens for Expo SDK 58
```

(The version numbers after `~58.0.` and `0.88.` are illustrative; the real ones come from the trigger check's plan.)
