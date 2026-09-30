# Migrations and frozen fixtures

A shipped save format is a compatibility contract (N10: "Saved progress survives every app update"). The format changes only through a new schema version, one pure migration step, and new frozen fixtures; the old files are never edited. `examples/save-v2/` is a complete, tested v1-to-v2 change to imitate.

## Contents

- The rules
- The migration runner
- Adding version N+1, step by step
- Writing a step
- Frozen fixtures and their checksums
- The tests each version adds
- What the load does with old and new saves
- When a change does not need a new version

## The rules

1. Never edit a shipped `save-doc-vN.ts`, `save-sections-vN.ts`, `save-run-vN.ts`, a shipped fixture JSON, or its checksum. A shipped version is what real phones hold.
2. Every version above 1 has exactly one step `vK -> vK+1` in `migrations/vK-to-vK+1.ts`, registered in `SAVE_MIGRATIONS` (ordered, append-only), with its own test.
3. A step is pure and frozen: plain JSON in, plain JSON out, literal values only. It never imports today's schema, defaults or runtime code, and never reads the clock, the device or randomness; otherwise a later change to a default would silently change how old saves upgrade.
4. Every version has two fixtures written by that app version and then frozen: `save-vN.minimal.json` (the default document) and `save-vN.full.json` (every section filled: a run with a move log, Premium owned, a streak, counters). Their `fnv1a32` checksums sit in `fixture-checksums.ts`.
5. The app never writes a save whose version is newer than itself; a newer save is played in memory and left untouched.
6. The change lands in one commit with a `Gate-Change:` trailer, because fixtures and checksums are gated files: an edit must be visible in review.

## The migration runner

```ts
// migrations/save-migrations.ts
export type SaveMigration = {
  readonly from: number;
  readonly migrate: (doc: Readonly<Record<string, unknown>>) => Record<string, unknown>;
};
/** Ordered, append-only. v1 is the first shipped version, so the list is empty until v2 exists. */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [];

runMigrations(steps, doc, { from, latest })   // null: a step is missing, the doc is not an object, or a step throws
migrateToLatest(doc, fromVersion)             // runMigrations(SAVE_MIGRATIONS, doc, { from, latest: LATEST_SAVE_VERSION })
```

The runner stamps `schemaVersion: version + 1` after each step, so a step never sets the version itself. A `null` result makes `decodeSlot` report the slot as damaged, so the load falls back to the backup and quarantines the row: a broken step can never crash the boot or be written back.

## Adding version N+1, step by step

Example: v2 adds `settings.textScale` (percent, 100..200). Files are in `examples/save-v2/packages/shell/src/services/save/`.

1. Write the failing test first: `migrations/v1-to-v2.test.ts` (the v1 minimal fixture gives the exact expected v2 JSON; the full v1 fixture migrates to a document that `validateSaveDoc` accepts; a fast-check property over valid v1 settings always migrates to a valid v2).
2. `schema/save-sections-v2.ts`: only the CHANGED sections, built from the frozen v1 ones:
   `export const SETTINGS_V2 = v.strictObject({ ...SETTINGS_V1.entries, textScale: TEXT_SCALE });`
3. `schema/save-doc-v2.ts`: `v.strictObject({ ...SAVE_DOC_V1.entries, schemaVersion: v.literal(2), settings: SETTINGS_V2 })`. Leave every v1 file untouched.
4. `schema/save-doc.ts`: `LATEST_SAVE_VERSION = 2`, `LATEST_SAVE_SCHEMA = SAVE_DOC_V2`, `SaveDoc = DeepReadonly<SaveDocV2>` (the three lines together).
5. `schema/default-save-doc.ts`: add the new field's first-launch value (`textScale: 100`).
6. `migrations/v1-to-v2.ts`: the pure step, then append `V1_TO_V2` to `SAVE_MIGRATIONS`.
7. Fix every compile error the new type causes (reducers, selectors, screens); `tsc` finds them all.
8. Fixtures: let the new code write `save-v2.minimal.json` (the default document) and `save-v2.full.json` (the full v1 fixture migrated, then filled for the new field), add both to `FIXTURES` in `save-fixtures.test.ts`, and record their checksums (run the fixture test once; it prints the actual value in the failure) in `fixture-checksums.ts`. Keep every v1 fixture and checksum.
9. Run the save tests and `check-save-layer`; commit with a `Gate-Change:` trailer that says which version was added and why.

## Writing a step

```ts
// migrations/v1-to-v2.ts
const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** v2 adds settings.textScale (percent). Pure and frozen: literal values only. */
export const V1_TO_V2: SaveMigration = {
  from: 1,
  migrate: (doc) => ({ ...doc, settings: { ...asRecord(doc['settings']), textScale: 100 } }),
};
```

- Work on `unknown` JSON: guard every nested read (`asRecord`), because the step runs before validation.
- Renames copy the old key to the new one and drop the old one; removals drop the key (strict schemas reject leftovers).
- Derive new values from the old document only (for example a count from an existing record), never from `Date` or device facts.
- Type only with the `SaveMigration` type (a `import type` from `save-migrations.ts`); `check-save-layer` reports any other import (`migration-pure`).

## Frozen fixtures and their checksums

```ts
// fixtures/save-fixtures.test.ts
const FIXTURES = [
  { name: 'save-v1.minimal', version: 1, json: saveV1Minimal },
  { name: 'save-v1.full', version: 1, json: saveV1Full },
] as const;   // every save version ever shipped, as the JSON an old app wrote. Append only.

it.each(FIXTURES)('keeps $name frozen', ({ name, json }) => {
  expect(fnv1a32(JSON.stringify(json))).toBe(FIXTURE_CHECKSUMS[name]);
});
it.each(FIXTURES)('upgrades $name to a valid latest document', ...);        // decodeSlot -> 'ok'
it.each(FIXTURES)('survives an encode/decode round trip for $name', ...);  // decode, encode, decode again
```

`check-save-layer` recomputes each fixture's `fnv1a32` itself and compares it with `fixture-checksums.ts` (`fixture-frozen`), checks that every version from 1 to the latest has both fixtures and checksum entries (`fixture-missing`), and that the test file lists them (`fixture-untested`). The v1 checksums in the templates are `'save-v1.minimal': '1b56e4df'` and `'save-v1.full': '11926b41'`.

## The tests each version adds

| Test | Proves |
|---|---|
| `vK-to-vK+1.test.ts`, example | the minimal old fixture becomes exactly the expected new JSON |
| `vK-to-vK+1.test.ts`, full fixture | the full old fixture migrates to a document the latest schema accepts |
| `vK-to-vK+1.test.ts`, property | any valid old section (fast-check arbitraries shaped like the old schema) migrates to a valid new document |
| `save-fixtures.test.ts` | every fixture of every version is unchanged, decodes to `ok`, and survives a round trip |
| `save-migrations.test.ts` | one step per version below the latest, in order; a latest doc is unchanged; a missing or throwing step gives `null` |

## What the load does with old and new saves

- An older version decodes through `migrateToLatest`, then validates against the latest schema; the load plan then writes both slots in the latest version (outcome `migrated`). The old row is gone from the slots after that write, which is why the fixtures, not the phone, keep the old shape testable.
- A newer version (a downgrade, or a TestFlight build older than the store build) decodes as `newer`: the app plays with a default document in memory, writes nothing all session, and shows the "please update" dialog at every launch.
- A step that fails, or a migrated document that does not validate, decodes as `damaged`: backup restore or reset-after-damage, with the bad row quarantined, never a crash.

## When a change does not need a new version

- Changing a default for NEW players only (`default-save-doc.ts`) when the stored shape is the same: no version, but existing players keep their stored value. Ask the owner whether that is the intent.
- A new game-specific counter id in `stats.counters` (a record keyed by id), or a new level key in `progress.levels`: the shape is unchanged.
- A game's own run `state` shape: that is the game's `PersistenceSpec.stateVersion` and `migrateState`, not the document version; an unmigratable run is dropped alone.
- Everything else (a new field, a renamed field, a new section, a tightened range) is a new document version.
