# Build

Build failures. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Variants

## Variants

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `build-metro-cache-variant` | A store build contains SHELL_TEST_BUILD_ONLY | Metro does not key its cache on EXPO_PUBLIC_* values | Key config.cacheVersion on EXPO_PUBLIC_APP_VARIANT | verified | `ios-simulator-build` |
