# Environment and SDK

The toolchain an Android emulator build needs on this Mac, where each part comes from, what is missing today, and which steps belong to the owner. Read it before the first Android build in a repo, when `check-emu-setup` fails on `jdk-pin`, or when the build's preflight stops (exit 2).

## Contents

- The pins
- What the Mac has (checked 2026-10-12)
- JDK 17 without a global switch
- The Android SDK and ANDROID_HOME
- Downloads and licences: the owner's word first
- The environment of every tooling process
- What the first Gradle build downloads
- .gitignore and disk
- Owner steps

## The pins

Expo SDK 57 builds Android with React Native 0.86.3's Gradle version catalog (`node_modules/react-native/gradle/libs.versions.toml`); Expo's root-project plugin reads it as `expoLibs`, so these numbers are what `npx expo prebuild --platform android` produces. They live in `ANDROID_PINS` (`packages/tooling/src/android/toolchain.ts`), and a change is a reviewed commit made together with an SDK move (expo-sdk-upgrade).

| Part | Pin | Read from |
|---|---|---|
| JDK | 17 (Android Studio's JBR) | AGP 8.12 and Gradle 9 run on 17 |
| compileSdk / targetSdk | 36 / 36 | `libs.versions.toml` `compileSdk`, `targetSdk` |
| minSdk | 24 | `libs.versions.toml` `minSdk` |
| build-tools | 36.0.0 | `libs.versions.toml` `buildTools` (aapt2 for check-emu-app comes from here) |
| NDK | 27.1.12297006 | `libs.versions.toml` `ndkVersion` (Hermes, Skia, Reanimated and the other native modules compile with it) |
| CMake | 3.22.1 | React Native's native build |
| Android Gradle Plugin | 8.12.0 | `libs.versions.toml` `agp` |
| Kotlin | 2.1.20 | `libs.versions.toml` `kotlin`; expo-iap needs it set through expo-build-properties (premium-purchase) |
| Gradle | 9.3.1 | the wrapper React Native's template writes |
| Emulator image | `system-images;android-35;google_apis;arm64-v8a` | this skill: a `google_apis` image allows `adb root`; API 35 runs on the installed emulator 35.1.20 |

Why API 35 and not 36 for the emulator: the app targets 36 and runs on 35 without change, and emulator 35.1.20 (installed) runs API 35 images today; an API 36 image may need a newer emulator, which is not verified on this Mac. Moving the image is a pin change like any other.

## What the Mac has (checked 2026-10-12)

| Part | Installed | Status |
|---|---|---|
| Android Studio JBR | `/Applications/Android Studio.app/Contents/jbr/Contents/Home`, OpenJDK 17.0.11 | ready |
| SDK | `~/Library/Android/sdk` | ready |
| platforms | android-34, 35, 36 | ready (36 is the pin) |
| build-tools | 35.0.0, 36.0.0 | ready |
| NDK | 28.2.13676358 only | **missing 27.1.12297006**: Gradle would download it by itself on the first build (about 1 GB); install it on purpose instead, after the owner's word |
| CMake | 3.22.1 | ready |
| emulator | 35.1.20 | ready |
| platform-tools | adb 35.0.2 | ready |
| cmdline-tools | `latest` (sdkmanager, avdmanager) | ready |
| system images | only `android-35/google_apis_playstore_ps16k/arm64-v8a` | **missing the pinned `google_apis` image**: a Play Store image cannot `adb root`, so it is never used for checks |
| licences | `~/Library/Android/sdk/licenses/` holds the SDK licences | accepted earlier by the owner |
| AVDs | `MindForge_Android_390x844`, `Pixel_8a_API_35` | another project's: never started, changed or deleted |

## JDK 17 without a global switch

- `selectAndroidToolchain()` looks at `JAVA_HOME`, then Android Studio's JBR, runs `<home>/bin/java -version` on each and picks the first major 17 (`pickJavaHome`). It throws naming every JDK it found when none is 17.
- The JDK is chosen per process through `JAVA_HOME` and `PATH`; nothing global changes. Never switch the Mac's default Java, never install a JDK with Homebrew for this: Android Studio's JBR is the one JDK 17 this Mac has, and other projects rely on the machine's default.
- `check-emu-setup` rule `jdk-pin` fails when `JDK_MAJOR` is not 17 or the tool environment does not set `JAVA_HOME`, `ANDROID_HOME`, `EXPO_NO_TELEMETRY` and `CI`.

## The Android SDK and ANDROID_HOME

`ANDROID_HOME`, else `ANDROID_SDK_ROOT`, else `~/Library/Android/sdk` (Android Studio's default; `androidHomeOf`). Before anything is built the preflight checks every pinned part (`sdkProblems`): the platform, build-tools, NDK, CMake and adb, then the emulator, avdmanager and the system image. A missing part stops the run with exit 2 and a line that names the `sdkmanager` package.

## Downloads and licences: the owner's word first

A missing SDK part is a download of hundreds of megabytes into the owner's SDK, so it is asked for, never done silently:

```sh
~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager "system-images;android-35;google_apis;arm64-v8a" "ndk;27.1.12297006"
```

- Run it only after the owner (or the lead, for this repo's planned downloads) has said yes in this session, and name it in the report.
- A licence prompt (`Accept? (y/N)`) is the owner's: Claude never answers it and never runs `sdkmanager --licenses`. The licences on this Mac were accepted earlier; a new package with a new licence stops there.
- Never let Gradle download the NDK by itself: the preflight stops before Gradle runs, so the download is always a decision.

## The environment of every tooling process

`androidToolEnv()` returns the caller's environment plus:

| Variable | Value | Why |
|---|---|---|
| `JAVA_HOME` | the JDK 17 home | Gradle and avdmanager use it |
| `ANDROID_HOME` | the SDK | Gradle, adb, emulator |
| `PATH` | `<jdk>/bin`, `<sdk>/platform-tools`, `<sdk>/emulator` first | the right `java`, `adb`, `emulator` |
| `EXPO_NO_TELEMETRY` | `1` | no telemetry from Expo CLI |
| `CI` | `1` | no interactive prompt can hang an unattended run |

`build-android-emu.ts` adds the three variant variables (`APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT`, `ADS_MODE`) once for the whole run.

## What the first Gradle build downloads

The first build fetches the Gradle 9.3.1 distribution into `~/.gradle/wrapper/dists/` and the Maven artifacts of React Native, Expo modules, AdMob and Play Billing into `~/.gradle/caches/` (a few GB in all). This is build tooling talking to Google's and Gradle's servers, like CocoaPods on iOS; N3 is about what the app does at run time. Later builds are offline from the cache.

## .gitignore and disk

```gitignore
apps/*/ios/
apps/*/android/
apps/*/build/
packages/*/android/build/
reports/
```

`apps/<game>/android/` is regenerated by every clean prebuild and never committed (`check-emu-setup` rule `gitignore`). Gradle's outputs sit inside it (`android/app/build/`); the build's logs and pulled saves go to `apps/<game>/build/`. Gradle also builds the Shell's own Kotlin module (performance-budgets' `ProcessStartModule`) where it lives, so its outputs land in `packages/shell/android/build/`: without `packages/*/android/build/` in `.gitignore` the first build leaves hundreds of untracked files, and Prettier's format check warns on its JSON (verified at the first Release build, 2026-10-16). An AVD takes about 6 GB under `~/.android/avd/`; delete only your own `e07-android-*` AVDs with `deleteOwnAvdArgs`.

## Owner steps

| Step | When | What the owner does |
|---|---|---|
| Android Studio (JDK 17) | no JDK 17 found | install Android Studio (its JBR is JDK 17) |
| SDK downloads | the preflight names a missing part | says yes to the `sdkmanager` line, or installs it in Android Studio's SDK Manager |
| SDK licences | `sdkmanager` asks to accept a licence | accepts it personally |
