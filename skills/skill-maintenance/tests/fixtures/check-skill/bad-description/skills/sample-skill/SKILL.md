---
name: sample-skill
description: Checks sample modules for Pocket Arcade. Use when writing or reviewing a sample module.
---

# Sample skill

Keeps sample modules pure and proves it with a checker.

## Rules that must hold

1. **Named exports only.** A default export lets every importer rename the function, so searches miss call sites.
2. **No clock in `rules/*`.** Reading `Date.now()` makes replays differ between devices and runs.

## Workflow

1. Read [references/guide.md](references/guide.md) before writing the module.
2. Copy `templates/apps/__GAME_ID__/sample.ts` and replace `__GAME_ID__` with the game id; compare with [examples/worked.md](examples/worked.md).
3. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-sample.mjs .` and fix every FAIL line.

## Definition of done

- [ ] The module has named exports only.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-sample.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Silencing the checker.** Fix the module instead; the check exists because the mistake is easy to make.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/guide.md](references/guide.md) | The rules and a worked example | Workflow step 1 |
| [examples/worked.md](examples/worked.md) | A finished module | Workflow step 2 |
| `templates/apps/__GAME_ID__/sample.ts` | The module template | Workflow step 2 |
| `scripts/check-sample.mjs` | The checker | Workflow step 3 |
| `scripts/selftest.mjs` | Proves the checker | After changing it |
| `tests/fixtures/` | Self-test inputs | When adding a rule |

## Related skills

- `other-skill` - naming files and exports.
