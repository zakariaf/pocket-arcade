# The Google Play Developer API

The calls `play-client.ts` makes, with node's own `fetch` and a JWT signed by `node:crypto`: no npm package, no Google client library. Release tooling only; the app never calls the network (N3).

## Contents

- Authentication
- The four calls
- Answers and stops
- What the API cannot do

## Authentication

A service account (owner step GP3) signs a JWT, which Google exchanges for an access token:

| Field | Value |
|---|---|
| header | `{ "alg": "RS256", "typ": "JWT" }` |
| `iss` | the service account's e-mail (`client_email` of the JSON key) |
| `scope` | `https://www.googleapis.com/auth/androidpublisher` |
| `aud` | `https://oauth2.googleapis.com/token` |
| `iat`, `exp` | now, and now plus 3600 seconds |

`POST https://oauth2.googleapis.com/token` with `content-type: application/x-www-form-urlencoded`, `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` and `assertion=<jwt>` answers `{ "access_token": "...", "expires_in": 3599 }`. The token is kept in the client's closure for the run and sent as `authorization: Bearer <token>`; it is never logged. The token endpoint is a constant of `play-client.ts`, never read from the key file.

## The four calls

All under `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/<package>/` (`PLAY_API`), the upload under `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/<package>/` (`PLAY_UPLOAD_API`). One edit carries one release:

| Step | Call | Body | Answer used |
|---|---|---|---|
| `edits.insert` | `POST .../edits` | none | `id` (the edit) |
| `edits.bundles.upload` | `POST .../edits/<edit>/bundles?uploadType=media` | the AAB bytes, `content-type: application/octet-stream` | `versionCode` Google read from the bundle |
| `edits.tracks.update` | `PUT .../edits/<edit>/tracks/internal` | `{ "track": "internal", "releases": [{ "versionCodes": ["<n>"], "status": "completed", "releaseNotes": [{ "language": "en-US", "text": "..." }] }] }` | |
| `edits.commit` | `POST .../edits/<edit>:commit` | none | the release is live for internal testers |

`status: completed` rolls the release out to everyone on the internal track. Only `internal` is ever written; `parseReleaseAndroidArgs` refuses any other track, because promotion is the owner's.

## Answers and stops

Every non-2xx answer becomes a `PlayStop` with a reason; the CLI prints it and ends with exit 1, never retrying:

| Reason | Answer | What the owner does |
|---|---|---|
| `api-not-enabled` | 403 with `SERVICE_DISABLED` or "has not been used in project" | enable the Google Play Android Developer API in the service account's project (GP3) |
| `auth` | 401 or 403 | invite the service account in Users and permissions with "Release apps to testing tracks" for this app (GP3), or replace a deleted key |
| `app-not-found` | 404 | create the app (GP1) and make the first upload in the Console (GP7) |
| `version-code-used` | 400 "version code that has already been used" | nothing: Claude starts a new run 1 (a new number); never edit `buildNumber` down |
| `policy-declarations` | 400 or 403 naming a declaration or policy | complete App content (GP4): Data safety, ads, target audience, content rating, advertising ID |
| `http-error` | anything else | read Google's one-line message in the stop; ask before any retry |

The message names the step, the reason, the HTTP status and Google's one-line `error.message`. It never holds the token, a header or the key.

## What the API cannot do

- It cannot create an app: GP1 is the owner's, in the Console.
- Whether it can upload the very first bundle of a new app is verified on the first run; the default is that the owner uploads the first AAB in the Console (GP7), and the API uploads every later one.
- One-time products (GP6) need an uploaded build with the BILLING permission first.
- It cannot accept policies, fill App content, or promote beyond what the service account's permissions allow; those stay the owner's.
