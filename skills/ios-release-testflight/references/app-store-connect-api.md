# App Store Connect REST: when, how, and the modules

altool covers validate, upload and build status. The small REST client covers what altool lacks. Read this before adding a REST call or when one fails.

## Contents

- When to use REST
- Tokens (JWT)
- The modules (templates)
- Error codes
- Verified

## When to use REST

| Need | Endpoint | When |
|---|---|---|
| App record exists, and its numeric Apple ID | `GET /v1/apps?filter[bundleId]=io.applander.<game>` (owner decision O4: every game's bundle id) | preflight, every release |
| Processing state | `GET /v1/builds?filter[app]=...&filter[version]=...&filter[preReleaseVersion.version]=...` | step 10 |
| What to Test | `GET /v1/builds/{id}/betaBuildLocalizations`, then `PATCH /v1/betaBuildLocalizations/{id}` or `POST /v1/betaBuildLocalizations` | step 11 |
| Internal tester group | `POST /v1/betaGroups` with `isInternalGroup: true`, `hasAccessToAllBuilds: true` | once per game; by default the owner creates it in the web UI together with the app record (step G2), because the owner must be added as its tester anyway |
| Register the bundle ID (optional) | `POST /v1/bundleIds` | before the first archive (otherwise `-allowProvisioningUpdates` registers it) |
| Premium in-app purchase | `POST /v2/inAppPurchases`, `POST /v1/inAppPurchaseLocalizations`, `POST /v1/inAppPurchasePriceSchedules`, plus the review screenshot | once per game (the purchase skill owns the payloads) |
| Age rating | `PATCH /v1/ageRatingDeclarations/{id}` | once per game, and when Apple changes the questions |
| Submit for review | `POST /v1/reviewSubmissions` (+ items) | per release, **only after the owner says "ship" and "submit"** |

There is no endpoint to create an app record (the Apps resource offers list, read and modify only): that is owner step G2. The App Privacy questionnaire is believed to be web-only (owner step G3).

## Tokens (JWT)

Apple's rules: header `alg ES256`, `kid <Key ID>`, `typ JWT`; payload `iss <Issuer ID>`, `iat`, `exp`, `aud "appstoreconnect-v1"`. "Tokens that expire more than 20 minutes into the future are not valid." `createAscJwt()` uses 15 minutes and signs with `dsaEncoding: 'ieee-p1363'` (the raw r||s signature JWTs need). A long wait (step 10) makes a fresh token per request.

`xcrun altool --generate-jwt` also exists but has keychain options; the Node script keeps the key in memory only. The current time comes from `nowEpochSeconds()` in `packages/tooling/src/clock/system-clock.ts`, the one tooling module allowed to read the wall clock.

## The modules (templates)

| File | Job |
|---|---|
| `packages/tooling/src/asc/asc-jwt.ts` | `createAscJwt(credentials, nowEpochSeconds)`: pure, tested with a throwaway key |
| `packages/tooling/src/asc/asc-credentials.ts` | `requireEnv`, `ascKeyPath`, `loadAscCredentials(env)`: the only reader of the `.p8`, into memory |
| `packages/tooling/src/asc/asc-client.ts` | `ascRequest(token, { method, path, body })` -> `{ ok, status, json }` or `{ ok: false, status, errors: [{ code, detail }] }` |
| `packages/tooling/src/asc/find-app.ts` | `findAppByBundleId(token, bundleId)` -> `{ id, name }` or `null` |
| `packages/tooling/src/asc/print-app-record.ts` | CLI: `node packages/tooling/src/asc/print-app-record.ts --app <game-id>` (or the bundle id `io.applander.<game id without hyphens>`) prints `{"id","name"}` or exits 2 (no record: owner step G2); any other id is refused (exit 1) |
| `packages/tooling/src/asc/beta-notes.ts` | `setWhatsNew(token, buildId, text)` and its pure payload builders |
| `packages/tooling/src/clock/system-clock.ts` | `nowEpochSeconds()` and `todayIso()` |

Imports follow the repo rule: the same folder as `./x.ts`, any other folder through the package name, `@e07/tooling/<path-under-src>.ts` (Node ignores tsconfig `paths`, and `../` is banned). `packages/tooling/package.json` is `{"name": "@e07/tooling", "private": true, "type": "module", "exports": {"./*": "./src/*"}}`: `"type": "module"` allows top-level `await` and stops the `MODULE_TYPELESS_PACKAGE_JSON` warning; the export map makes the self-reference resolve in Node, tsc and ESLint. The tooling tsconfig sets `types: ["node", "jest"]` because the tests sit next to the scripts.

## Error codes

Apple advises to **prefix-match** `errors[].code`, never to drive logic from `detail`:

| Code prefix | Status | Meaning | Action |
|---|---|---|---|
| `NOT_AUTHORIZED` | 401 | wrong key or issuer ID, revoked key, or clock skew (`iat` in the future) | stop: check the IDs against the key file name (without reading it) and that the Mac clock is on network time; a revoked key needs owner step O3 |
| `FORBIDDEN_ERROR` | 403 | key role below Admin, an individual key, or a missing agreement | stop: owner step O3 (team key, Admin) or R4 (agreement) |
| `NOT_FOUND` | 404 | wrong ID or path | fix the request |
| `ENTITY_ERROR` | 409/422 | invalid payload | fix the payload; `detail` may be shown to the owner |

## Verified

On 2026-09-26: the JWT verified with Node `crypto.verify` (ieee-p1363) and with OpenSSL, using a throwaway P-256 key; the client against the live API with that throwaway key returned `401 NOT_AUTHORIZED`, parsed into `errors[0].code`, and `findAppByBundleId` threw `App Store Connect answered 401 (NOT_AUTHORIZED)`; every endpoint and `filter[...]` parameter above exists in Apple's documentation JSON. On 2026-09-28 the templates here passed tsc 6.0.3, the project ESLint config and Jest (45 tests including a JWT round trip with a generated key). Not run: any call with the real key.
