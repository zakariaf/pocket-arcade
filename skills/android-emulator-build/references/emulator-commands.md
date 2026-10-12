# Emulator commands

Every command `npm run build:android:emu` runs, with its flags, so a step can be run by hand or a failing step understood. All paths are under the SDK (`$ANDROID_HOME`, `~/Library/Android/sdk` on this Mac). Several emulators and sessions share this Mac: every `adb` call names its serial with `-s`, and only `e07-android-*` AVDs are ever created, started or deleted.

## Contents

- The run, step by step
- Creating the AVD
- Starting it on a free console port
- Waiting for boot
- The demo-mode status bar
- Install, launch, ready, screenshot
- Reading the save and the perf log
- Shutting down and cleaning up
- Commands that are never run

## The run, step by step

| Step | Command (run from) | Log |
|---|---|---|
| preflight | JDK 17, the SDK pins, the emulator, avdmanager and the system image exist | printed; exit 2 |
| prebuild | `npx expo prebuild --platform android --clean` (apps/<game>) | `apps/<game>/build/logs/prebuild.log` |
| gradle | `android/gradlew -p android assembleRelease --console=plain` (apps/<game>) | `apps/<game>/build/logs/gradle.log` |
| AVD | `avdmanager create avd --name e07-android-<purpose> --package <image> --device pixel_8`, once | printed |
| emulator | `emulator -avd e07-android-<purpose> -port <port> -no-snapshot -no-boot-anim -no-audio -no-window` (detached) | `apps/<game>/build/logs/emulator.log` |
| boot | `adb -s emulator-<port> shell getprop sys.boot_completed` every second until `1` | |
| status bar | the demo-mode broadcasts below | |
| install | `adb -s emulator-<port> install -r <apk>` | |
| launch | `adb -s emulator-<port> shell am start -W -n <package>/.MainActivity` | |
| ready, screenshot | `adb -s emulator-<port> exec-out screencap -p > reports/android/<game>/smoke-<variant>-<ads>.png` every 500 ms | |

The APK lands at `apps/<game>/android/app/build/outputs/apk/release/app-release.apk`. A Release APK is signed with the debug keystore the template generates; that is fine for an emulator and never for Play (android-release-play builds and signs the AAB).

## Creating the AVD

```sh
~/Library/Android/sdk/cmdline-tools/latest/bin/avdmanager create avd \
  --name e07-android-smoke --package "system-images;android-35;google_apis;arm64-v8a" --device pixel_8
```

- avdmanager asks "Do you wish to create a custom hardware profile? [no]": the tooling answers `no` on stdin.
- No `--force`: an existing AVD is reused, never overwritten. `emulator -list-avds` lists them.
- The name always comes from `avdName(purpose)` (`e07-android-` plus kebab-case); `check-emu-setup` rule `avd-name` fails any other literal name.
- Device ids come from `avdmanager list device -c` (`pixel_8`, `pixel_8_pro`, `pixel_tablet`, `medium_tablet`). The parity profile (toybox-visual-parity) defines its own size.

## Starting it on a free console port

- `adb devices` lists running devices as `emulator-<port>`; `freeConsolePort` takes the first even port from 5554 that no running emulator holds (adb uses the odd port above it).
- When the AVD already runs, the tooling finds its serial with `adb -s <serial> emu avd name` on each running emulator and reuses it.
- `-no-snapshot` boots cold (no stale state from another run), `-no-window` keeps the run unattended; `screencap` works without a window.
- The emulator is started detached with its output in `build/logs/emulator.log`, so it keeps running after the CLI ends.

## Waiting for boot

`adb -s <serial> shell getprop sys.boot_completed` fails while the device is not listed and prints an empty line while Android boots; `1` means booted (`isBootCompleted`). The tooling polls every second for up to 4 minutes, never a fixed sleep: a cold first boot of a new AVD takes 1-2 minutes, a warm one 20-40 seconds.

## The demo-mode status bar

A still status bar for every screenshot, set after each boot (`demoModeCommands`):

```sh
adb -s emulator-5554 shell settings put global sysui_demo_allowed 1
adb -s emulator-5554 shell am broadcast -a com.android.systemui.demo -e command enter
adb -s emulator-5554 shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941
adb -s emulator-5554 shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb -s emulator-5554 shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4 -e mobile hide
adb -s emulator-5554 shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
```

`-e command exit` leaves demo mode.

## Install, launch, ready, screenshot

- `install -r` replaces an earlier install and keeps its data (like a store update).
- `am start -W -n <package>/.MainActivity` returns once the first frame is drawn; Expo names the activity `<package>.MainActivity`.
- Ready is the iOS rule (`readyReason`): the perf log's cold-start entry from this launch (test builds, once Home is interactive), or two identical screenshots in a row at least 3 s after launch (8 s when a perf log exists without the entry).
- `adb -s <serial> exec-out screencap -p` writes a PNG to stdout (`exec-out`, not `shell`, so no line-ending conversion). Open it with the Read tool and look at it: the right screen, text drawn in Lilita One (not Roboto), no crash dialog, not black, white or blank.

## Reading the save and the perf log

A `google_apis` image allows `adb root`, so the Release app's files can be read without `run-as` (which needs a debuggable app):

```sh
adb -s emulator-5554 root
adb -s emulator-5554 pull /data/data/io.applander.linesiege/files/SQLite/ apps/line-siege/build/emu-save/
```

expo-sqlite keeps `save.db` (with `-wal` and `-shm`) in the app's `files/SQLite/` folder. Pulling the folder takes the WAL along, so the copy reads what the app last wrote. A Play Store image refuses `adb root`: that is why it is never used for checks.

## Shutting down and cleaning up

- `adb -s emulator-<port> emu kill` shuts down one emulator: only one this session started, at the end of the task.
- `avdmanager delete avd --name e07-android-<purpose>` deletes your own AVD (`deleteOwnAvdArgs` refuses any other name).

## Commands that are never run

| Command | Why not |
|---|---|
| never `adb kill-server`, never `adb start-server` with another port | cuts off every session's emulators on this Mac |
| `adb <command>` without `-s` | reaches whichever device answers first |
| starting, wiping or deleting `MindForge_Android_390x844`, `Pixel_8a_API_35` or any non-`e07-android-` AVD | another project's device |
| never `emulator -wipe-data` on a shared AVD | destroys another task's state; use your own AVD |
| `sdkmanager --licenses`, answering a licence prompt | the owner's step |
| `npx expo run:android`, `./gradlew installDebug`, Metro | a Debug build is not what players run |
