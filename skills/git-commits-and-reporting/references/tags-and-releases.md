# Tags, versions and release commits

One repository holds about 26 apps, so every tag carries the game id. Tags, release commits and uploads come only from `npm run release:ios`; this page says what they look like and what never happens to them.

## The two tags

| Tag | When | Example |
|---|---|---|
| `<game-id>/v<X.Y.Z>+<build>` | after every successful upload to App Store Connect (test and store builds) | `line-siege/v1.0.0+8` |
| `<game-id>/v<X.Y.Z>` | when the owner says "ship" for that version (the build sent for review) | `line-siege/v1.0.0` |

- `X.Y.Z` is the app's version (`expo.version`, the iOS short version string). PATCH is fixes only, MINOR adds features or level packs, MAJOR is an owner decision.
- `<build>` is the monotonic build number in `game.config.ts` (the iOS bundle version). It only goes up within a game, across versions, and is never reused.
- Both forms pass `git check-ref-format`. The Shell and the packages are not tagged: they ship inside the apps.
- Never move, delete or reuse a tag. A bad build gets a new build number, never the old tag.
- A release tag without an upload tag for the same version is impossible in a correct history: the owner ships a build that was uploaded and play-tested.

`scripts/check-tags.mjs` checks the format, the game id, the upload tag behind every release tag, and the build-number order: across versions by version number, and in upload order by each tag's creation date (read with `git for-each-ref`), so a lower build number tagged after a higher one of the same version is caught too. With `--list <file>` a line may carry the date as `<tag> <unix seconds>`; without dates only the order across versions is checked.

## Release commits

- `npm run release:ios -- --app <game-id> --variant test|store` bumps the build number before the archive and commits it as `chore(<game-id>): build <n>` with a `Release-Variant: test|store` trailer (the only change is the build number in `game.config.ts`), then tags `<game-id>/vX.Y.Z+<n>` after the upload succeeds. On the owner's "ship" it sets `<game-id>/vX.Y.Z`.
- A store build's version must be higher than the game's last release tag `<game-id>/vX.Y.Z` (upload tags contain `+` and do not count).
- Uploading, tagging for release, submitting for review and pushing are outward-facing: they need the owner's word in this session (see `stop-and-ask.md`). "Submit" happens only after the owner says "submit".

## Pushing

The spec does not say whether the owner uses a remote. Until the owner says so, pushing is outward-facing: ask first. When a push happens, the pre-push hook runs `npm run verify`; never skip it.
