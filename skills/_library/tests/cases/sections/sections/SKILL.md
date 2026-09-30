---
name: sections
description: Checks sample greetings for the validator self-test. Use when testing the Pocket Arcade skill validator.
---

# Sample greetings

A small, valid skill that the validator self-test changes one rule at a time.

## Rules that must hold

1. **Greet first.** Every greeting starts with "Hello", so the reader knows what it is.

## Workflow

1. Read [references/guide.md](references/guide.md).
2. Copy [templates/greeting.ts](templates/greeting.ts) into the app and fill in the placeholder.

## Anti-patterns

- Skipping the guide and guessing the wording.

## Definition of done

- [ ] The greeting is copied and filled in.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/guide.md](references/guide.md) | How greetings are written | Workflow step 1 |
| [templates/greeting.ts](templates/greeting.ts) | Greeting function to copy | Workflow step 2 |

## Related skills

- `skill-template` - the model skill every new skill starts from.
