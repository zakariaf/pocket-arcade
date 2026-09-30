# Signing and the App Store Connect key

How a Pocket Arcade build is signed without anyone clicking in Xcode, what the team API key must be, and the rules that keep the key and the tokens made from it from ever leaking.

## Contents

- What signs what
- The key: kind, role, location
- The three environment variables
- Rules for the key and for tokens
- Where the key may be read, and by whom
- The keychain
- Entitlements
- Leak response (owner)
- What was verified and what was not

## What signs what

| Step | What Xcode does | Needs |
|---|---|---|
| **Archive** (`xcodebuild archive -allowProvisioningUpdates` plus `-authenticationKeyPath/-authenticationKeyID/-authenticationKeyIssuerID`) | talks to the developer portal with the key: registers the App ID for the bundle ID if needed, creates or downloads a development profile, signs the archive with an **Apple Development** certificate whose private key is in the login keychain; creates that certificate if the team has none usable on this Mac (unverified with a key alone; fallback: owner step O7) | the team key, an unlocked login keychain, `DEVELOPMENT_TEAM` (from `APPLE_TEAM_ID` at prebuild time) |
| **Export** (`xcodebuild -exportArchive`, `method app-store-connect`, `signingStyle automatic`) | re-signs for distribution with a **cloud-managed** Apple Distribution certificate, whose private key stays with Apple, and an App Store profile | a team key with the Admin role |
| **Validate / upload** (`xcrun altool`) | authenticates with the same key | `--api-key <id> --api-issuer <issuer>`; altool finds `AuthKey_<id>.p8` itself |

There is exactly one signing method: automatic signing with the team API key. Never export or import `.p12` files, never create profiles by hand, never switch signing method to get past an error (the failure playbook says what to do instead).

This Mac (2026-09-26): one Apple Development and two Apple Distribution identities in the keychains (`security find-identity -v -p codesigning`); both Distribution identities carry the `APPLE_TEAM_ID` team.

## The key: kind, role, location

| Item | Rule |
|---|---|
| Kind | a **team** key. Individual keys cannot use the provisioning endpoints. altool names individual keys `ApiKey_<id>.p8`; team keys are `AuthKey_<id>.p8`, but only App Store Connect > Users and Access > Integrations shows the real kind and role |
| Role | **Admin**. Only the Account Holder or an Admin can create cloud-managed distribution certificates; an App Manager key can upload but not sign |
| Created by | the owner (step O3) |
| Location | `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`, mode `600`, outside the repo |
| Checked by the agent | path and mode only: `test -f "$KEY_PATH"` and `stat -f %Sp "$KEY_PATH"` must print `-rw-------`. The file is never opened |

## The three environment variables

The owner puts them in `~/.zshenv` (never in the repo):

```sh
export ASC_KEY_ID=<Key ID>          # e.g. 2X9R4HXF34
export ASC_ISSUER_ID=<Issuer ID>    # UUID from Users and Access > Integrations
export APPLE_TEAM_ID=<Team ID>      # 10 characters; withShell writes it to ios.appleTeamId -> DEVELOPMENT_TEAM
```

These names are fixed; every tool uses exactly these three. The key path is derived: `~/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8`. `APPLE_TEAM_ID` must be set **before prebuild**, because prebuild writes it into the Xcode project; a missing team gives "No profiles were found" or "requires a development team".

State of this Mac on 2026-09-26: one `AuthKey_*.p8` with mode `-rw-------`; `APPLE_TEAM_ID` set; `ASC_KEY_ID` and `ASC_ISSUER_ID` not set in the agent's environment. So the first release starts with owner step O3.

## Rules for the key and for tokens

1. **Never open, print, copy, move, commit or log the `.p8` file.** Tools receive only the three IDs.
2. **Tokens are secrets too.** Never print the JWT, the `Authorization` header, or a full request with headers. Error messages from `ascRequest` carry the API's error codes only.
3. **Scripts that read the key never pass it on a command line or through an environment variable, and never write it to a temporary file.**
4. **Real AdMob IDs are not secrets** (they ship in every store build), but they live only in `game.config.ts` and reach the runtime only in live builds.
5. **Stop and ask, never retry,** on a signing or authorisation failure: retry loops can lock the account or burn build numbers.

## Where the key may be read, and by whom

| Reader | How | Why it is allowed |
|---|---|---|
| `xcodebuild` | `-authenticationKeyPath` names the file | Apple's own tool signs with it |
| `xcrun altool` | finds `AuthKey_<id>.p8` in `~/.appstoreconnect/private_keys` by itself | Apple's own tool |
| `packages/tooling/src/asc/asc-credentials.ts` | `readFileSync` into memory, to sign one 15-minute ES256 JWT | the only project file allowed to read it (`check-release-setup.mjs` rule `key-read`) |

Claude Code's `.claude/settings.json` denies `Read(~/.appstoreconnect/**)`, `Read(**/*.p8)`, `Read(**/AuthKey_*)`, `Read(**/*.p12)` and `Read(**/*.mobileprovision)`. Those rules cover Claude's own file tools and recognised shell reads, not child processes (the release script must be able to sign), so rule 1 is the real guard and the deny rules are defence in depth.

Commits: `.gitignore` lists `*.p8`, `AuthKey_*`, `ApiKey_*`, `*.p12`, `*.mobileprovision`, `*.xcarchive`, `*.ipa`, and the lefthook `no-secrets` job refuses staged key or signing files even with `git add -f`. Before a release, `git grep -n "BEGIN PRIVATE KEY"` must find nothing (`check-release-setup.mjs` rule `key-material` does the same over the files).

## The keychain

The archive runs `codesign` with a key in the login keychain, which must be unlocked. That is normal in the owner's logged-in desktop session and **not** in an SSH session. Preflight: `security show-keychain-info ~/Library/Keychains/login.keychain-db` must exit 0 (it did on 2026-09-26; its behaviour on a locked keychain was not tested).

- `errSecInternalComponent` from `codesign` = keychain locked. Stop; owner step O8 (the owner runs `security unlock-keychain ~/Library/Keychains/login.keychain-db` in Terminal, or starts the run from the desktop). The agent never handles the password.
- A macOS dialog "codesign wants to access key ..." = the key's access list does not include codesign yet; the owner clicks **Always Allow** once.

## Entitlements

- Prebuild writes `ios/<App>/<App>.entitlements`. In-app purchase needs no entitlement key on iOS (believed, not verified).
- The StoreKit test harness adds `get-task-allow` in **Debug only**; the store-artifact gate proves it is absent from the Release export (`codesign -d --entitlements - --xml <App>.app`).

## Leak response (owner)

If key material ever appears in the repo, a log or a report: stop, and ask the owner to revoke the key in App Store Connect > Users and Access > Integrations, create a new team key with the Admin role, replace the file, and update `ASC_KEY_ID` / `ASC_ISSUER_ID`. Then check `git log -p -S "BEGIN PRIVATE KEY"` and the `reports/` folder.

## What was verified and what was not

Verified on 2026-09-26 (Xcode 26.6, altool 26.40.1): every `xcodebuild -exportOptionsPlist` key and flag used here appears in `xcodebuild -help`; an unsigned device archive (`CODE_SIGNING_ALLOWED=NO`) succeeds in 66 s; the JWT signer verifies with Node `crypto.verify` and OpenSSL using a throwaway P-256 key; the live REST API answered that throwaway key with `401 NOT_AUTHORIZED`, parsed into `errors[0].code`.

Not run (needs the owner's key; the agent must not use it outside a real release): a signed archive, export, `--validate-app`, `--upload-package`, `--build-status`, any REST call with the real key, and the entitlement check on a distribution-signed app. Record what the first real release shows (the failure playbook lists the open questions).
