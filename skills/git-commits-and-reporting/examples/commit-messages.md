# Commit messages: good and bad

Each good message passes `scripts/check-commits.mjs`; each bad one fails with the rule named.

## Good

A feature with its spec lines:

```text
feat(line-siege): clear full columns and fire a beam

Spec 13 (Line Siege) and 8.13: a full column clears and damages the
first monster in that column. Examples, a determinism property and a
golden for daily 2026-09-26 cover it.

Gate-Change: new data golden for the daily level of 2026-09-26
```

A fix that says what was wrong:

```text
fix(shell): keep the streak when the clock goes back

Spec S9: days already done stay done if the phone's clock goes
backwards. The streak reducer compared day keys with the wall clock;
it now keeps the latest recorded day. A property over shuffled dates
covers it.
```

A parity waiver (`parity/waivers.json` is a gated path, and the owner report names the waivers):

```text
test(shell): waive the dashed edges of the locked tiles

Spec S8: iOS draws a dashed border with its own dash length and phase,
so the 17 locked tiles and the locked pack panel differ in structure.

Gate-Change: pre-listed platform waivers for React Native dashed edges
```

A spec change the owner made, with both trailers in the last paragraph:

```text
fix(game-kit): give 2 stars up to par + 3

The owner widened the two-star band after the play-test.

Spec-Change: spec 8.1 two stars now reach par + 3 (owner decision)
Co-Authored-By: Claude <noreply@anthropic.com>
```

A refactor (no behaviour change, so no spec lines needed):

```text
refactor(game-kit): name the two-star limit
```

## Bad

| Message | Rule it breaks | Why it matters |
|---|---|---|
| `Updated stuff.` | header-format | no type or scope, nothing to search for |
| `feat(ui): add buttons` | header-scope | `ui` is not a workspace folder; use `shell` |
| `feat: add endless mode` | scope-missing | the change lives in a folder; name it |
| `fix(line-siege): Fixed the tray` | subject-case, subject-mood | imperative, lowercase: "fix the tray" |
| `feat(line-siege): add endless mode` with no body | body-missing | the owner cannot see why or which spec lines |
| `feat(shell): add the stats card` with a body naming no spec line | spec-ref-missing | every feature serves a spec line (S10 here) |
| a commit staging `eslint.config.mjs` without `Gate-Change:` | gate-change-missing | gate changes must be findable and agreed |
| `Gate-Change:` in the middle of the body | trailer-placement | git reads trailers only in the last paragraph |
| `Spec-Change: the test was wrong` | spec-change-format | Spec-Change needs a spec section; "the test was wrong" is never a spec change |
