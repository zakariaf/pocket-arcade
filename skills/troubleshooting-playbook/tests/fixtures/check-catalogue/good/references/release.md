# Release

Release failures. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Signing

## Signing

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `release-keychain-locked` | errSecInternalComponent from codesign | The login keychain is locked | Stop: the owner unlocks the keychain | documented, owner | `ios-release-testflight` |
