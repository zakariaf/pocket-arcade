# The product in App Store Connect, price and human steps

## Contents

- Product rules
- Price (owner decision O2)
- Family Sharing
- Creating the product with the API
- Remaining steps
- Human steps
- Android later

## Product rules

- One product per game: product ID `<bundleId>.premium` (the bundle id is always `io.applander.<game id without hyphens>`, owner decision O4, so Line Siege's is `io.applander.linesiege.premium`), type `NON_CONSUMABLE`, reference name "Premium". The same ID sits in `apps/<game>/game.config.ts` as `premium.productId`.
- Product IDs: letters, digits, `.`, `-`, `_`, at most 100 characters, and never reusable in the same app, even after deletion. Choose it once and never change it.
- Localizations: App Store Connect has no Persian or Sorani, so the product has en-US and de-DE texts only (display name 2-30 characters, description at most 45): "Premium" / "No ads, ever. One-time purchase." and "Premium" / "Nie wieder Werbung. Einmalkauf.". The app never shows these; S12 uses the Shell catalogs.
- The first non-consumable must be submitted with a new app version (Apple: "The first ... In-App Purchase ... must be submitted with a new app version").

## Price (owner decision O2)

EUR 1.99, an App Store price point, in the base territory Germany (`DEU`); Apple equalises the other territories, and the app always shows the price the store reports for the player's territory (never a typed one). The owner decided it on 2026-09-30 (it replaced the product spec's older, rounder target). `create-premium-iap.ts` targets exactly `TARGET_EUR = 1.99` and takes no price flag; it stops, listing the nearest points, only if Apple no longer offers EUR 1.99, and then the owner decides. The price can be changed later in App Store Connect without an app update; `check-premium.mjs` rule `price-target` keeps the script at 1.99 and the spec's old target out of the Premium files.

## Family Sharing

Off: owner decision O3 (2026-09-30). Leave Family Sharing off when creating the product, in the web UI or through the script (`familySharable: false` in `createIapBody`), and never turn it on: Apple cannot turn it off again for that product. The StoreKit template and every configuration the harness generates say `familyShareable: false`, and `check-premium.mjs` rule `family-sharing` fails on any other value in those files and in the ASC payload. (If it were ever on, a family member's access could be revoked, which the evidence rule would handle like a refund.)

## Creating the product with the API

The App Store Connect API can create the in-app purchase, its localizations, price schedule, availability, review screenshot and submission; it cannot create the app record (a human step). Templates in `packages/tooling/src/asc/`:

- `premium-iap-payloads.ts`: pure request bodies: `createIapBody(appId, productId)` (`inAppPurchases`, `NON_CONSUMABLE`, `familySharable: false`, a review note), `PREMIUM_LOCALIZATIONS` + `localizationBody`, `closestPricePoints(points, target)`, `priceScheduleBody(iapId, pricePointId, 'DEU')` (the `'${price-0}'` string is JSON:API local-ID syntax, not a template), `availabilityBody`, `screenshotReserveBody`, `screenshotCommitBody`.
- `create-premium-iap.ts <bundleId>`: finds the app by bundle ID, finds or creates the product (`GET /v1/apps/{id}/inAppPurchasesV2?filter[productId]=...`, `POST /v2/inAppPurchases`), adds missing localizations (`POST /v1/inAppPurchaseLocalizations`), reads the DEU price points (`GET /v2/inAppPurchases/{id}/pricePoints?filter[territory]=DEU&limit=8000`, one page holds all), picks the exact EUR 1.99 point or stops with the three nearest (only when Apple no longer offers it), and posts the price schedule (`POST /v1/inAppPurchasePriceSchedules`, which replaces an existing schedule). Re-running is safe.
- `asc-jwt.ts`, `asc-credentials.ts`, `asc-client.ts`: the ES256 JWT (15-minute lifetime; Apple rejects more than 20), the key loader and the fetch client. If the repo already has them (the iOS release work owns them), keep the existing files.
- `packages/tooling/src/clock/system-clock.ts`: the only tooling module that reads the wall clock (`nowEpochSeconds`, `todayIso`). If the repo's copy lacks `nowEpochSeconds`, add it.

Credentials: the tools read `ASC_KEY_ID` and `ASC_ISSUER_ID` from the environment (set in `~/.zshenv`, never in the repo); only `asc-credentials.ts` reads `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`, into memory. Never open, print, copy or log the key or a JWT made from it; error messages contain the API's error body only.

Schemas were read from Apple's API reference on 2026-09-26; the script has not run against the live API (it needs the owner's key). Its first run is part of the first game's store step. Availability and the review screenshot are not in the script yet: add them as two more steps of `create-premium-iap.ts` with the same `call` helper and the payload builders above (keep re-runs safe: read the product's current availability and screenshot first and skip what exists), and report each response's error body only.

## Remaining steps

| Step | Endpoint | Body | Note |
|---|---|---|---|
| Availability | `POST /v1/inAppPurchaseAvailabilities` | `availabilityBody(iapId, territories)` | territory IDs from `GET /v1/territories?limit=200` (about 175 territories; follow `links.next` if the response has one, or the product is sold in only the first page); `availableInNewTerritories: true` |
| Review screenshot | `POST /v1/inAppPurchaseAppStoreReviewScreenshots` -> PUT the bytes to each upload operation -> `PATCH .../{id}` | `screenshotReserveBody`, then `screenshotCommitBody` (md5 hex) | the S12 simulator screenshot at an App Store screenshot size; used for review only |
| Submission | with the first app version | none | the owner selects Premium on the version page before "Submit for Review"; later IAPs could use `POST /v1/inAppPurchaseSubmissions` |

## Human steps

Ask the owner, in plain words, and wait:

- **Once:** the Paid Apps Agreement, tax and banking in App Store Connect. Without it the product cannot be sold or reliably tested on TestFlight.
- **Per game:** create the app record (no API for it) with the fixed bundle id `io.applander.<game id without hyphens>` (owner decision O4).
- **Per game:** nothing to decide about the product: the price is EUR 1.99 (O2) and Family Sharing stays off (O3). Claude runs `create-premium-iap.ts` (or the owner creates the product in the web UI: Monetization -> In-App Purchases -> + -> Non-Consumable, reference name "Premium", product ID `<bundleId>.premium`, price EUR 1.99, and Family Sharing left off).
- **First release:** on the version page, add Premium under "In-App Purchases and Subscriptions" before submitting.
- **Per game:** the Tier 3 TestFlight test (buy, cancel, reinstall + restore).

## Android later

A Play Console managed product with the same ID, license testers, and an internal test track (billing works only for Play-installed builds). expo-iap 5.8.0 uses Play Billing 9.1.0; Android builds need Kotlin 2.1.20 via `expo-build-properties`.
