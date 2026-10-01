# Example messages: a finished release, a stop, a missing app record

Three messages the owner receives, written the way the release pipeline and this skill produce them. The owner never reads code or logs; these messages are the review.

## 1. A store build is ready (after `release:ios` printed VALID)

```text
Line Siege 1.0.0 (build 8) is in TestFlight as a store build.

What I checked before uploading: the store build contains no debug menu or test code, uses the
game's real AdMob app ID and its own id io.applander.linesiege, carries Apple's tracking question
in all four languages, has no StoreKit test files and no debug entitlement, and was built by
Xcode 26.6 (store-artifact gate: PASS). Apple validated and processed it (state VALID).

What testers see under "What to Test":
  Line Siege 1.0.0 (8) · store build
  What changed
  - feat(line-siege): add pack 3
  - fix(line-siege): undo after a win no longer restores the board
  Please check
  - play pack 3, levels 1-5
  - Buy Premium, cancel a purchase, delete the app, reinstall, then Restore.
  - Switch the language to فارسی and کوردیی ناوەندی once: layout mirrored, nothing cut off.
  Known issues
  - none

Your turn (step R1): play it on your iPhone and answer "ship" or "don't ship".
Meanwhile I keep working on pack 4 on the simulator; nothing else is uploaded.

Evidence: build tag line-siege/v1.0.0+8; logs in apps/line-siege/build/logs/;
check-store-artifact.mjs --ipa ... --variant store --ads live --version 1.0.0 --build 8: RESULT: PASS.
Not verified by me: the real purchase sheet and haptics (only a device shows them).
```

## 2. A stop (the keychain is locked)

`release:ios` printed this and exited; the agent forwards it as is and does not retry:

```text
Release stopped at step "archive" (owner step O8).
Error: error: errSecInternalComponent
Needed: Unlock the login keychain on the Mac (security unlock-keychain ~/Library/Keychains/login.keychain-db in Terminal), or start the run from the logged-in desktop.
I will resume from this step once you confirm.
```

Below that the run printed two lines for the agent, not for the owner: `(log: apps/line-siege/build/logs/archive.log)` and `Resume: rerun the same command with --resume build ...`. The build number was already bumped and committed (build 8) and nothing was uploaded, so when the owner confirms the agent runs `npm run release:ios -- --app line-siege --variant store --resume build`: it checks that HEAD is still `chore(line-siege): build 8`, reuses build 8, and starts again at the prebuild.

## 3. The app record is missing (first release of a game)

```text
Before the first TestFlight upload of Maze Loop, App Store Connect needs its app record, and the
public API cannot create one (step G2, about 2 minutes):

App Store Connect > My Apps > + > New App:
  Platform: iOS   Name: Maze Loop   Primary language: English (U.S.)
  Bundle ID: io.applander.mazeloop   SKU: maze-loop   (fixed: io.applander.<game id>)
Then, in the new app: TestFlight > Internal Testing > +, name "Owner", turn on automatic
distribution and add yourself, so every build I upload appears in TestFlight on your iPhone.

Reply "done" when both exist. Until then I keep testing the game on the simulator; nothing is
uploaded and no build number is used.
```

## What is wrong in these bad versions

- "Release failed, retrying..." after `errSecInternalComponent`: a stop is never retried; retries can lock the account.
- "Uploaded! Should be in TestFlight soon." right after `altool --upload-package`: upload is not done until processing says VALID.
- A report that pastes the JWT or the `Authorization` header "for debugging": tokens are secrets.
- "I switched to manual signing to get past the error": never change the signing method; follow the playbook row or stop.
