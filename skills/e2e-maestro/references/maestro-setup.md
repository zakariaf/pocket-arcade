# Maestro: install, environment and versions

How Maestro gets onto the Mac, how it runs without sending anything anywhere, and how to move the pin.

## Contents

- What is pinned
- Installing (no Homebrew)
- The environment every run needs
- Commands that are verified on 2.10.0
- Commands that are banned
- Checking syntax without a simulator
- Changing the pin
- Optional: Maestro's MCP server

## What is pinned

| Tool | Version | Notes |
|---|---|---|
| Maestro CLI | 2.10.0 | `maestro.zip` SHA-256 `29b675e10cc12080e445e9bfb2e2b4e4dfb9c0f2e30d5884120d258b5e1cd991` (from the release's `checksums_sha256.txt`) |
| Java | 17 | `/usr/libexec/java_home -v 17`, else Android Studio's bundled JBR (`/Applications/Android Studio.app/Contents/jbr/Contents/Home`, 17.0.11 on the verification Mac) |
| Xcode / simulator runtime | Xcode 26.6, iOS 26.5 | runtime id `com.apple.CoreSimulator.SimRuntime.iOS-26-5` |
| Devices | iPhone 17 Pro Max (`phone`), iPad Pro 13-inch (M5) (`tablet`) | both exist for iOS 26.5 locally and on the `macos-26` CI image; "iPhone 16 Pro on iOS 26.5" does not exist |
| pixelmatch / pngjs / @types/pngjs | 7.2.0 / 7.0.0 / 6.0.5 | root devDependencies for `compare-png.ts`; pixelmatch 7 is ESM-only |

## Installing (no Homebrew)

`templates/packages/tooling/scripts/install-maestro.sh` is the only way Maestro is installed:

- downloads `https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.10.0/maestro.zip` once into `~/Library/Caches/e07/` (315 MB; worktrees share it);
- checks it with `shasum -a 256 -c`; on a mismatch it deletes the zip and exits 1 (never update the pin to match a download);
- unzips into `<repo>/tools/maestro` (gitignored as `/tools/`), writes `tools/maestro/.version`, prints `maestro --version`;
- is idempotent: a second run with the same version exits 0 at once.

The runner calls it before every run, so nobody installs Maestro by hand. Verified: cached zip, idempotent rerun, checksum mismatch deletes the file and exits 1.

## The environment every run needs

`maestroEnv()` in `templates/packages/tooling/src/e2e/simulator.ts`:

```ts
JAVA_HOME: process.env['JAVA_HOME'] ?? javaHome(),   // Java 17
MAESTRO_CLI_NO_ANALYTICS: 'true',
MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
MAESTRO_DISABLE_UPDATE_CHECK: 'true',
```

The three variables were read in the 2.10.0 jar: no analytics, no "analyze your run" prompt, no update check. So a run sends nothing off the Mac. Set them in your shell too when calling `tools/maestro/bin/maestro` directly.

## Commands that are verified on 2.10.0

`launchApp: { clearState, clearKeychain, stopApp }`, `killApp` (process death, for the save-survives-a-kill check), `stopApp`, `openLink`, `runFlow: { file, env }` and `runFlow: { when: { visible }, commands }`, the short `runFlow: <file>` form, `extendedWaitUntil` (with `visible: { id }` and `timeout`), `assertVisible` / `assertNotVisible` with `id` and an optional `text` regex, `tapOn: { id }` and `tapOn: { point: 'x,y' }` (a point tap reaches a Skia canvas gesture in a Release build), `copyTextFrom: { id }`, `evalScript: ${...}` (JavaScript with `maestro.copiedText` and a shared `output` object), `assertTrue`, `waitForAnimationToEnd: { timeout }`, `takeScreenshot: <name>`, and a `# comment` line between steps.

Facts learned the hard way:

- **A flow's `env:` value beats `-e`.** In 2.10.0 a variable defined in the flow's `env:` block overrides the same variable passed on the command line. So flows never define `APP_ID`, `APP_SCHEME`, `LANG` or `THEME` (the runner passes them with `-e`).
- **Maestro runs only the top-level files of a folder** it is given. The runner lists `flows/<area>/*.yaml` explicitly; a file in `flows/` itself or two levels down never runs, and a sub-flow placed in `flows/` would run on its own and fail.
- **iOS simulators have no airplane mode** (`setAirplaneMode` is Android-only). Offline runs use the debug parameter `offline=1`, and the socket sampler proves no traffic.
- Strings are single-quoted (Prettier's `singleQuote` formats YAML too); `${VAR}` works inside single quotes.

## Commands that are banned

- `assertWithAI`, `assertNoDefectsWithAI`, `extractTextWithAI`: they upload screenshots to a third-party service.
- CLI commands and flags that send runs off the Mac (checked in `maestro --help` of 2.10.0): `maestro cloud`, `maestro login`, `maestro list-cloud-devices`, `maestro test --analyze` ("AI Insights"), and `maestro record` without `--local` (it renders the video remotely). `maestro bugreport` and `maestro download-samples` are not needed either.
- `retry` around app assertions: allowed only around OS-owned UI (system alerts), under a `# system-ui: <why>` comment.
- Text selectors (`tapOn: 'Play'`): select by `id` only, so flows run unchanged in four languages. Only OS-owned UI (the "Open in <app>?" prompt) may be matched by text, under a `# system-ui:` comment.

## Checking syntax without a simulator

`tools/maestro/bin/maestro check-syntax <file>` parses one flow and exits 1 with `Invalid Command: tapOnn at /syntax-checker:3:9` or `Unknown Property: idd` (verified). It takes about 3 s per file (a JVM start). `node ${CLAUDE_SKILL_DIR}/scripts/check-flows.mjs . --syntax` runs it on every flow and sub-flow.

## Changing the pin

1. Read the release page (`https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-<version>`) and its `checksums_sha256.txt`.
2. Update `MAESTRO_VERSION` and `MAESTRO_SHA256` in `install-maestro.sh`, and the pin table in `check-e2e-setup.mjs` and this page, in one commit with a `Gate-Change:` trailer (the script is a gated path).
3. Rerun every flow and `check-flows.mjs --syntax`; re-read the env variable names in the new jar.

## Optional: Maestro's MCP server

`claude mcp add maestro -e JAVA_HOME="$JAVA_HOME" -- "$PWD/tools/maestro/bin/maestro" mcp` registers the local binary as an MCP server. It is not needed for any step of this skill.
