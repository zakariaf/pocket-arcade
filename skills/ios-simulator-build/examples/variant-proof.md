# Example: back-to-back test and store builds, proven

A real run on 2026-09-28 (macOS 27.0, Xcode 26.6 selected through `DEVELOPER_DIR`, iOS 26.5 simulator, Expo SDK 57.0.25) with this skill's templates, on a copy of the architecture test workspace (`apps/line-siege`, a Shell whose screens are still empty stubs). It shows what "done" looks like, including a failure the screenshot check caught.

## 1. Test build (test variant, test ads)

```text
$ npm run build:ios:sim -- --app line-siege --variant test --ads test
build:ios:sim: prebuild ...
build:ios:sim: xcodebuild ...
build:ios:sim: test/test app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app
build:ios:sim: ready (stable-screen) on e07-smoke <udid>; screenshot reports/ios/line-siege/smoke-test-test.png
build:ios:sim: open the screenshot and look at it: white or black means the app failed.
(2 min 46 s: prebuild with cached pods, full Release simulator build, install, launch, wait)
```

`ready (stable-screen)`: this Shell had no perf log yet, so the run waited for two identical screenshots after at least 3 s.

```text
$ node ${CLAUDE_SKILL_DIR}/scripts/check-sim-app.mjs --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --variant test --ads test --version 1.0.0 --build 1
check-sim-app: 1 app (test/test) checked, 0 problems
RESULT: PASS
```

## 2. Store build right after, no cache cleared

```text
$ npm run build:ios:sim -- --app line-siege --variant store --ads off
build:ios:sim: prebuild ...
build:ios:sim: xcodebuild ...
build:ios:sim: store/off app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app
build:ios:sim: ready (stable-screen) on e07-smoke <udid>; screenshot reports/ios/line-siege/smoke-store-off.png
(2 min 14 s)

$ node ${CLAUDE_SKILL_DIR}/scripts/check-sim-app.mjs --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --variant store --ads off
check-sim-app: 1 app (store/off) checked, 0 problems
RESULT: PASS
```

`--ads off` because the game had no real AdMob IDs yet (a `live` build needs them, owner step G5). The raw evidence behind the PASS:

```text
$ grep -a -c SHELL_TEST_BUILD_ONLY .../LineSiege.app/main.jsbundle
0
$ plutil -extract GADApplicationIdentifier raw .../LineSiege.app/Info.plist
ca-app-pub-3940256099942544~1458002511
$ plutil -extract DTXcode raw .../LineSiege.app/Info.plist
2660
EXConstants.bundle/app.config extra: {"appVariant":"store","adsMode":"off",...}
```

Checking the same store app as if it were a test build fails, which shows the checker reads the real artefact:

```text
FAIL .../EXConstants.bundle/app.config [constants-variant] extra.adsMode is "off", expected "test" ...
FAIL .../main.jsbundle [test-code] test build does not contain SHELL_TEST_BUILD_ONLY: it was bundled as a store build ...
RESULT: FAIL (3 problems)
```

## 3. The screenshots: a real finding

```text
$ node ${CLAUDE_SKILL_DIR}/scripts/check-screenshot.mjs reports/ios/line-siege/
FAIL reports/ios/line-siege/smoke-store-off.png [blank-screen] 100.0% of the screen is #F2F2F2 (React Navigation's default background, so the screen rendered no content): ...
FAIL reports/ios/line-siege/smoke-test-test.png [blank-screen] 100.0% of the screen is #F2F2F2 (...)
RESULT: FAIL (2 problems)
```

Opening the PNG confirmed it: status bar at 9:41 and an empty light-grey screen. The app launched and wrote its save (both slots in `Documents/SQLite/save.db`), and no JS error was logged, but the workspace's screens are stubs that render nothing. The build and the variant are proven; the screen is not. In a real task this is not done: build the screen, rebuild, and check again until the screenshot shows it.

## 4. The report to the owner

```text
Line Siege, simulator smoke build (iPhone 17 Pro Max, iOS 26.5):
- Test build and store build made back to back: the store build contains no debug code and
  uses Google's sample ad ID with ads off; both were built by Xcode 26.6.
- The first screen is still empty (light grey): the screens of this workspace render nothing yet.
  Not done until Home is built and visible in the screenshot.
Evidence: reports/ios/line-siege/smoke-test-test.png, smoke-store-off.png;
check-sim-app PASS (test/test, store/off); check-screenshot FAIL (blank-screen, 2 files).
```
