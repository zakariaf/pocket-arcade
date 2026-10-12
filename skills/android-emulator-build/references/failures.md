# Failures and fixes

Symptom, cause and fix for the failures an Android emulator build can hit: the environment, prebuild, Gradle and its native builds, the variant, the emulator and adb. Match the first error line of the failing step's log (`apps/<game>/build/logs/<step>.log`), fix the cause (never the check), rerun the failing step, then the checks. For a failure that is not here, run troubleshooting-playbook's `find-fix.mjs --log <log>`; once solved, it is recorded there. Entries marked "not seen here yet" come from Expo's and Google's documentation and wait for the first real build (Android step 5) to be confirmed.

## Contents

- Environment and preflight
- Prebuild
- Gradle, Kotlin and the NDK
- Hermes, Metro and the variant
- Emulator and adb
- The app on the emulator

## Environment and preflight

| Symptom | Cause | Fix |
|---|---|---|
| `JDK 17 is not installed (found: ...)` (exit 2) | no JDK 17 in `JAVA_HOME` or Android Studio's JBR | owner step: install Android Studio; never switch the Mac's default Java |
| `NDK 27.1.12297006 is missing ...` (exit 2) | the pinned NDK is not in the SDK (this Mac has 28.2 only) | ask first, then `sdkmanager "ndk;27.1.12297006"` (a download) |
| `missing .../system-images/android-35/google_apis/arm64-v8a` (exit 2) | the pinned emulator image is not installed | ask first, then `sdkmanager "system-images;android-35;google_apis;arm64-v8a"` |
| `Accept? (y/N)` from sdkmanager | a licence not accepted yet | stop: the owner accepts licences |
| `SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable` | Gradle ran without `ANDROID_HOME` | run through `npm run build:android:emu` (it sets it), or export `ANDROID_HOME` for a hand run |

## Prebuild

| Symptom | Cause | Fix |
|---|---|---|
| `withShell: ... bundleId must be io.applander.<id>` | a placeholder or wrong package | fix `game.config.ts` (owner decision O4) |
| prebuild writes default permissions (`SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`) | `android.permissions` not set, so Expo's template defaults stay | `withShell`'s permission allowlist and `blockedPermissions` (architecture-and-boundaries) |
| a hand edit in `android/` vanished | Continuous Native Generation regenerated the folder | put the setting in `withShell` or a plugin in `packages/shell/plugins/`; never edit `android/` |

## Gradle, Kotlin and the NDK

| Symptom | Cause | Fix |
|---|---|---|
| `Unsupported class file major version 65` or `... requires Java 17` | Gradle started on JDK 21 or 11 | `JAVA_HOME` to the JBR (`androidToolEnv`); never change the global Java |
| `Kotlin ... is not supported by Expo modules` / KSP version error | a Kotlin version without a matching KSP | keep `kotlinVersion` at React Native's 2.1.20 through expo-build-properties |
| `Could not resolve all files for configuration ':app:releaseRuntimeClasspath'` | first build offline, or a Maven artifact missing | rerun with the network; the first build fills `~/.gradle/caches` |
| `NDK not configured` / Gradle starts downloading an NDK | the pinned NDK is missing and the preflight was bypassed | install the pinned NDK first (ask), then rerun |
| `CMake '3.22.1' was not found` | CMake missing | `sdkmanager "cmake;3.22.1"` (ask first) |
| `Execution failed for task ':app:mergeReleaseResources'` after an icon change | a generated icon path no longer exists | rerun `render-art.ts` (code-drawn-art-and-icons), then prebuild with `--clean` |
| `java.lang.OutOfMemoryError: Metaspace` | the daemon's default heap is too small for a full native build | the template's `gradle.properties` sets `org.gradle.jvmargs`; if missing, raise it through a config plugin, never in `android/` |

## Hermes, Metro and the variant

| Symptom | Cause | Fix |
|---|---|---|
| store APK contains `SHELL_TEST_BUILD_ONLY` (`check-emu-app` `test-code`) | Metro reused test-build transforms, or the variable was lost | `metro.config.js` `cacheVersion` keyed on the variant; export the variables for the whole run; rebuild |
| test APK without the sentinel | built with `EXPO_PUBLIC_APP_VARIANT=store` or a stale cache | export `test` for the whole run and rebuild |
| `extra.adsMode is "test", expected "off"` (`constants-variant`) | `ADS_MODE` changed between prebuild and Gradle | one environment for the whole run |
| `meta-data E07AppVariant is missing` (`variant`) | the variant marker plugin has no Android half yet, or prebuild did not run | architecture-and-boundaries' `with-app-variant-marker.ts`; prebuild with `--clean` |
| `com.google.android.gms.ads.APPLICATION_ID ... expected the game's own` (`ad-app-id`) | a live build fell back to Google's sample id | `ads-config.ts` gives no sample id in live builds (admob-ads); supply GP5 |

## Emulator and adb

| Symptom | Cause | Fix |
|---|---|---|
| `adb: more than one device/emulator` | a call without `-s` | every call through `adbArgs(serial, ...)` (`check-emu-setup` `adb-serial`) |
| `adb: device offline` right after start | the device is listed before adbd is up | keep polling `sys.boot_completed`; it fails until the device is online |
| `PANIC: Missing emulator engine program for 'x86' CPU` | an x86 image on Apple silicon | the pinned arm64-v8a image |
| `emulator: ERROR: Running multiple emulators with the same AVD` | the AVD already runs under another serial | the tooling reuses it (`adb -s <serial> emu avd name`); never start a second copy |
| `adbd cannot run as root in production builds` | a Play Store image | use the pinned `google_apis` image |
| boot never completes, `emulator.log` shows `HVF error` | the Mac's hypervisor is busy (another VM) | stop your own other emulators; report it if it persists (not seen here yet) |

## The app on the emulator

| Symptom | Cause | Fix |
|---|---|---|
| white or black screenshot (`check-emu-app` `screenshot`) | the JS crashed or the app is still loading | `adb -s <serial> logcat -d -s ReactNativeJS:V AndroidRuntime:E`, fix the cause, rebuild |
| `Missing application ID. AdMob publisher ID expected` crash at launch | no `APPLICATION_ID` meta-data | every non-live build carries the sample id (admob-ads) |
| title drawn in Roboto, not Lilita One | the font is not resolved by its file name on Android | toybox-design-system: font families by file name (`check-design-system`) |
| RTL screens laid out left to right | `supportsRtl` missing (`check-emu-app` `supports-rtl`) | `withShell` sets it |
