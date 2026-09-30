# Descriptions and routing

How to write a description that makes Claude load the skill for the right tasks and leave it for its neighbours, and how to prove it with routing evals. Read this before writing or changing any description, and when a skill loads for the wrong task or not at all.

## Contents

- Why the description is everything
- The formula
- Rules
- Good and bad examples
- Keeping 45 descriptions apart
- Routing evals
- Writing eval prompts
- When an eval fails

## Why the description is everything

Claude sees only names and descriptions until it invokes a skill; the body is read afterwards. A rule written only in the body cannot make the skill load. The listing is budgeted (see the how-skills-load reference): long descriptions push other skills down to name-only. Claude also under-uses skills for tasks that look easy, so a description names situations, not just a topic.

## The formula

`<Verb>s <what, packed with the concrete nouns of the job>. Use when <the intents and trigger words a task would contain>. Not for <the neighbour's work> (<neighbour-skill>).`

- At most 300 characters. Third person, starting with a verb ("Builds", "Checks", "Ships", "Diagnoses", "Adds"). No `<` or `>`, no "I" or "you".
- The first 8 to 12 words are unique across the set: a distinct verb and object.
- The "Use when" part lists what a task would say: file names, commands, symptoms ("upload fails"), screen IDs, error words.
- The "Not for" part names the neighbouring work and, in parentheses, the exact skill folder name that owns it. It is how Claude tells two close skills apart.

## Rules

1. State both what the skill does and when to use it.
2. Put the key use first: when the listing is over budget whole descriptions disappear, and Claude reads the lead first.
3. Be a little pushy: name contexts where the skill helps even when the task does not name its domain ("a gate fails", "renders wrong").
4. Use the words the owner and the tasks use (TestFlight, simulator, streak, RTL, Premium), including synonyms.
5. Describe intent, not implementation ("Ships a game to TestFlight", not "runs release-ios.ts").
6. Do not fix a missed eval by pasting its words into the description (overfitting); generalise to the category of intent.
7. Keep "when to use" guidance out of the body; it is read too late.
8. One controlled vocabulary across the set: Shell, game app, screen, board, golden, design screenshot mean one thing everywhere.

## Good and bad examples

Good (each splits the space with its neighbour):

```yaml
description: Ships a Pocket Arcade game to TestFlight - API-key signing, archive, export, store-artifact gate, altool validate/upload, VALID wait, What to Test, build numbers, tags, owner steps. Use when releasing, uploading or signing a build or an upload fails. Not for simulator builds (ios-simulator-build).
description: Builds and runs a Pocket Arcade game as a Release iOS simulator app - clean prebuild, xcodebuild with Xcode 26.6, test/store variants, Metro cacheVersion, e07- simulators, launch, screenshot. Use when building, running or smoke-testing on the simulator. Not for TestFlight (ios-release-testflight).
```

Bad, and why:

```yaml
description: Helps with games.                                   # vague, no "Use when", no boundary
description: I can help you build Expo screens.                  # first person
description: Use for all React Native, Expo, TypeScript and UI tasks.   # swallows every sibling
description: Runs release-ios.ts and patches app.json.            # implementation, not intent
description: Builds screens following the design chapter of the handbook.   # points at project files
```

## Keeping 45 descriptions apart

- `check-skill-set.mjs skills` flags two descriptions that share more than 30% of their content words (before "Not for"), two that start with the same five content words, a "Not for" hand-off to a skill that does not exist, and a listing over 20,000 characters (two thirds of the 30,000 measured at the default budget). On 2026-09-28 the 44 finished skills peaked at 12.5% overlap (tdd-workflow and unit-and-component-tests) and totalled about 14,100 characters.
- When two skills keep colliding, sharpen both: each description names what it owns and puts the other in its "Not for". If two skills always load together and share one check, merge them; if one skill has two unrelated checks, split it.
- The index skill (when it exists) must name every skill with when to load it; `check-skill-set.mjs` checks that.

## Routing evals

`assets/routing-evals.json` holds realistic task prompts, at least two per skill, each with the skill that should handle it: `[{ "prompt": "...", "expect": "skill-name" }]`, or `"expect": null` for a prompt that should load none of the project skills.

- Offline (default, free, seconds): `node ${CLAUDE_SKILL_DIR}/scripts/check-routing.mjs --skills-root skills` ranks all skills for each prompt with a lexical stand-in for Claude (description words weighted by rarity, name words double, words only in "Not for" counting against) and fails when the expected skill is not in the top 3. On 2026-09-28 all 89 prompts of the 44 finished skills ranked their skill in the top 3 (84 first). The word "skill" counts like any other word, so a task about skills themselves ("add a skill for ...") reaches this skill. It is an early warning that a description lost its words, not proof.
- Live (costs one short model call per prompt and run): add `--live` (and `--runs 3`, `--only <skill>`) to run `claude -p "<prompt>" --output-format stream-json --verbose` in the repo and read the first tool call; a Skill call names the chosen skill, any other first tool counts as no skill. An eval passes when at least half the runs choose the expected skill. Verified 2026-09-28: in a throwaway repo with two skills both routed correctly, a "What is 2 + 2?" prompt loaded none, and a planted mismatch failed as `route-miss`; in a scratch repo whose `.claude/skills` linked all 44 skills, the eight prompts of four skills all routed to their skill (45 s in total). Claude only sees skills linked into the repo's `.claude/skills`, so run live mode where the links exist (`--skills-root .claude/skills` works too). Use it after a description rewrite of your skill and its neighbours, not on every change.
- A prompt that names the skill always routes (the owner naming skills is the normal case); evals test the unnamed case.
- While a skill is still being built, `--skip-missing` turns its evals into notes.

## Writing eval prompts

- Write them as the owner writes tasks: casual, specific, with file names, games, screens and symptoms. "the banner ad must never appear for Premium owners" beats "configure ads".
- Leave out the skill's name and its most unusual words; include the words a task would really use.
- Add near misses: a prompt that shares words with the skill but belongs to a neighbour, with the neighbour as `expect`. They are the valuable ones ("the ball tunnels through walls" belongs to the real-time loop, not to the board renderer).
- Two prompts per skill in the shared file; more for skills that border many others.

## When an eval fails

1. Read which skills won. If the winner is a better home for that task, the prompt's `expect` is wrong: fix the eval.
2. Otherwise change the description of the expected skill (its lead words) or add a "Not for" boundary to the winner. Change the category of intent, not the eval's exact words.
3. Rerun the offline evals for the whole set (a description change can steal other skills' prompts), then `--live --only <skill> --runs 3` for the skills you touched.
4. Keep the description at most 300 characters; rerun the validator and `check-skill-set.mjs`.
