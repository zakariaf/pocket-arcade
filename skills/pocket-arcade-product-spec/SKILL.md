---
name: pocket-arcade-product-spec
description: Explains what Pocket Arcade must do - the Shell, screens S1-S15, non-negotiables N1-N12, features 7.x-8.x, the game contract, the 26 games and decisions D1-D9. Use when a task names a spec ID, screen, game or feature, or asks what is required. Not for how to build it (use pocket-arcade-index).
---

# Pocket Arcade product spec

This skill holds the complete product spec: what the Shell and every game must do, screen by screen and feature by feature, the rules that never bend, the 26 games, and the decisions still open. Use it to know exactly what to build and to cite it correctly; two scripts print any spec entry verbatim and prove that every citation in the repo is real.

## Rules that must hold

1. **The spec decides what; N1-N12 never bend.** If a task, a design or a library would break a non-negotiable, stop and ask the owner before writing code. The owner never reads code, so a silently traded rule is never caught.
2. **Quote the spec, never paraphrase it from memory.** Run `spec-lookup.mjs <id>` and put the ID and the rule in the first test's title or a comment, and in the commit body. Misremembered numbers (a 3-minute ad gap, a 45-star unlock) are the bugs no test catches.
3. **Cite IDs exactly as the spec numbers them:** screens `S1`-`S15` and `S11a`-`S11d`, non-negotiables `N1`-`N12`, sections `spec 8.3`, decisions `D1`-`D9`, games by id (`line-siege`). Name screens by name and ID together: "Home (S4)". `check-spec-refs.mjs` fails on any ID that does not exist or a name paired with the wrong ID.
4. **When the spec is silent or ambiguous about something a player would see, stop and ask:** quote the spec lines, give the options with a recommended default, and keep working on other things. Never invent product behaviour.
5. **Use the documented default for an open decision and say so** (D1-D9 and the platform decisions in `references/open-decisions.md`). Ask only when the default no longer works. A decision the owner has settled (O1-O6 below) is never asked again, and the owner's personal steps (O6) never block any work.
6. **One game = one app, one Shell.** A game provides exactly the game contract (spec 10); everything shared lives in the Shell (N5). If a game needs something the Shell lacks, add it to the Shell for every game, never inside the game.
7. **Game ids are the catalogue's kebab-case ids and are stable forever** (`apps/line-siege`). A new or renamed game needs the owner's approval first.
8. **Build nothing from "Not in version 1"** (spec 14): no accounts, leaderboards, achievements, analytics, subscriptions, coins, push notifications or level editor, even when it looks helpful.
9. **Every built screen must match its Toybox design screenshot** (the owner's rule). The spec says what a screen shows; the `toybox-visual-parity` skill proves how it looks.

## The spec at a glance

Non-negotiables (full text: `references/non-negotiables.md`):

| ID | Rule |
|---|---|
| N1 | Offline first: everything works in airplane mode, forever |
| N2 | No accounts, no server, no cloud, no analytics, no crash service, no remote config |
| N3 | Our own code makes no network requests; only AdMob and the store purchase system go online |
| N4 | One game = one app (own name, icon, listing, ad IDs, purchase) |
| N5 | One Shell: shared screens and services live only in the Shell |
| N6 | Four languages from day one (en, de LTR; fa, ckb RTL), every screen checked in both directions |
| N7 | One purchase: Premium, EUR 1.99 (owner decision O2), removes all ads forever |
| N8 | Ads never interrupt play: no ad during a level, the tutorial or app start |
| N9 | Everything made by Claude Code: art drawn in code, sounds synthesised or CC0 |
| N10 | Saved progress survives every app update: versioned saves, tested upgrades |
| N11 | No layout code says left or right: start and end only (boards decide for themselves) |
| N12 | Every sentence is one translatable message with placeholders and plural forms |

Settled on 2026-09-30 and 2026-10-01 (full text: `references/open-decisions.md`), overriding any older default:

| Id | Decision |
|---|---|
| O1 | Tracking follows Apple's rules (D4 reversed): S3 intro when Google's form follows, Google's form where required, then Apple's tracking prompt while unanswered, then ads; declined still shows ads without the advertising id; never with ads off, Premium, offline, before the tutorial or during a level; text `consent.tracking.usage-description` |
| O2 | Premium is EUR 1.99 (D3 decided); the app shows only the store's localised price |
| O3 | No Family Sharing for Premium |
| O4 | App ids are `io.applander.<game id without hyphens>` (`io.applander.linesiege`), Premium `<bundle id>.premium`; the owner no longer approves a bundle id |
| O5 | Every text meets 4.5:1 in every state (light `dangerFill` `#FFDCDF`) |
| O6 | The owner's fa/ckb review, the Line Siege play-test and listening to the sound previews are the owner's personal steps: listed under "Owner steps (not blocking)", never waited for |
| L7-L9 | Home's daily card opens S9 and its Play key plays (L7); no Hint key without solver hints (L8); Persian score line height 1.45 (L9) |
| L10 | (2026-10-01) S3's intro shows only before Google's form; when only Apple's prompt is due, it appears on its own with our sentence |
| L11 | (2026-10-01) Never strand a finished run: no continue possible means the result at once (endless result or lose result); an offer whose ad is still loading shows a loading state, so hidden means unavailable |
| L12-L13 | (2026-10-01) S15 keeps design parity like every screen (L12), and its texts stay English in all four languages (L13) |
| L14 | (2026-10-01) The skills win over the handbook on code detail; the completeness check and every ship gate fail on each owner placeholder (AdMob ids G5, privacy host and support address G3) until the owner supplies it; the fa/ckb review is an owner step, never a release gate |

Screens: S1 Splash, S2 First-run language choice, S3 Ad consent and tracking, S4 Home, S5 Game screen, S6 Pause menu, S7 Result screen, S8 Levels, S9 Daily challenge, S10 Statistics, S11 Settings (S11a Language, S11b About and credits, S11c Privacy policy, S11d Licences), S12 Premium, S13 How to play / Tutorial, S14 Dialogs, S15 Debug menu (test builds only).

Where each ID lives:

| IDs | Reference |
|---|---|
| sections 0, 1, 2, 4, 9, 14, 15 (15.1-15.8), 17; who does what | `references/product.md` |
| 3, N1-N12 | `references/non-negotiables.md` |
| 5, 6, S1-S15, S11a-S11d | `references/screens.md` |
| 7, 7.1-7.6, 8, 8.1-8.14 | `references/features.md` |
| 10, 11, 12 and the code names | `references/game-contract.md` |
| 13 and the 26 game ids | `references/game-catalogue.md` |
| `line-siege-rules` (the pilot's complete v1 rules and numbers) | `references/line-siege-rules.md` |
| 16, D1-D9, platform decisions, the owner's decisions O1-O6 and the lead's decisions L1-L9 of 2026-09-30 and L10-L14 of 2026-10-01, spec gaps | `references/open-decisions.md` |

## Workflow

1. **Find the spec lines the task serves.** Use the table above to pick the reference and read the section, or print it straight away: `node ${CLAUDE_SKILL_DIR}/scripts/spec-lookup.mjs S9 8.3` (`--list` shows every ID and title).
2. **Read the non-negotiables the task touches** in `references/non-negotiables.md` (any network, layout, text, save, ad or purchase work touches at least one). Plan so none bends.
3. **For a game task**, read the game's entry in `references/game-catalogue.md` (pitch, loop, twist, controls, v1 content cap, known risks) and the contract in `references/game-contract.md`. For Line Siege also read [references/line-siege-rules.md](references/line-siege-rules.md) (`spec-lookup.mjs line-siege-rules`): every rule and number of v1, each a default until the owner's play-test, and the owner questions still open. Keep v1 content to the stated cap; Claude tends to over-deliver scope.
4. **Check `references/open-decisions.md`** for a decision or spec gap in the way. Use its default and name it in the report. Its "Owner decisions of 2026-09-30" (O1-O6) and "Lead decisions of 2026-09-30 and 2026-10-01" (L1-L14) are settled: follow them (each screen entry in `references/screens.md` names the one it follows, for example S3's tracking order (L10), S4's daily card (L7), S7's never-stranded run end (L11) and S15's parity and English texts (L12, L13)).
5. **If the spec is silent or contradicts itself** on anything a player would see, stop and ask (rule 4) with the quoted lines and a default.
6. **Write the spec IDs into the work:** the first failing test's title or comment quotes the rule (`// spec S9: the first completion of the day counts`), the commit body names the IDs, the report names screens as "Home (S4)".
7. **Run the checks** from the repo root: `node ${CLAUDE_SKILL_DIR}/scripts/check-spec-refs.mjs .`. Fix every `FAIL` line (wrong ID, wrong screen name, unknown app folder) and rerun until it prints `RESULT: PASS`.

## Definition of done

- [ ] The spec lines the work serves were printed with `spec-lookup.mjs` and are quoted in the first test or a comment and in the commit body.
- [ ] No non-negotiable (N1-N12) was traded away; any conflict was raised with the owner before building.
- [ ] Every open decision or spec gap the work relied on is named in the report with the default used.
- [ ] Nothing from "Not in version 1" (spec 14) was built.
- [ ] Every app folder under `apps/` is a catalogue game id (or one the owner approved).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-spec-refs.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Citing from memory** ("spec 8.7 says ads wait 5 minutes"). Print the entry with `spec-lookup.mjs`; the ad gap is 3 minutes and lives in 8.8.
- **Inventing screen numbers** such as "S16 Leaderboard" for a new idea. New screens are an owner decision; leaderboards are not in version 1 at all.
- **Building a feature inside one game** that every game will want (a settings row, a stats card layout, a purchase flow). It belongs in the Shell (N5).
- **Treating "offline" as "mostly offline":** a "please connect" message anywhere but the Premium page (S12), a spinner waiting for the network, or a remote image breaks N1 or N3.
- **Letting Premium unlock levels, coins or a second product.** Premium removes ads and makes hints and continues free (D2, N7).
- **Renaming a game id** because the display name changed. The id names the folder, the commit scope and every i18n key; it is stable forever.
- **Asking the owner about something the spec or a default already answers.** Read the reference first; ask only about real gaps.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/product.md](references/product.md) | The product in one page: pieces, build order, players, ads-vs-offline resolution, offline table, not in v1, definition of done 15.1-15.8, requirement map, who does what | Starting any work on the Shell, or when scope is unclear |
| [references/non-negotiables.md](references/non-negotiables.md) | N1-N12 with what each means in practice and what enforces it | Workflow step 2, before any network, layout, text, save, ad or purchase work |
| [references/screens.md](references/screens.md) | Screen map, navigation rules, and S1-S15 (S11a-S11d) in full | Any screen task, before building or testing a screen |
| [references/features.md](references/features.md) | Languages, RTL, numbers and fonts (7.x); levels, modes, daily, saving, sound, ads, Premium, accessibility, look, testing hooks, errors (8.x) | Any cross-screen feature task |
| [references/game-contract.md](references/game-contract.md) | What a game provides (spec 10), its configuration (11), making the next game (12), and product terms mapped to code names | Starting or wiring a game |
| [references/game-catalogue.md](references/game-catalogue.md) | The 26 games with ids, pitch, loop, twist, controls, v1 content, risks and the research lessons | Picking, designing or building a game |
| [references/line-siege-rules.md](references/line-siege-rules.md) | Line Siege v1 rules: board, lanes, tray, pieces, placement order, monsters, win and lose order, score, difficulty rows, levels, daily, endless, continue, cues, measured balance, owner questions | Any Line Siege task (rules, balance, levels, board, copy) |
| [references/open-decisions.md](references/open-decisions.md) | D1-D9, the platform decisions and spec gaps, each with its default; the owner's settled decisions of 2026-09-30 (O1 tracking prompt, O2 EUR 1.99, O3 no Family Sharing, O4 `io.applander` ids, O5 contrast, O6 owner steps never block) and the lead's (L1 no-music S11/S6, L3 score line on S7, L4 Line Siege teaching text, L6 S5-S7 parity without a board reference, L7 Home's daily card opens S9, L8 no Hint key without hints, L9 Persian score line height; and of 2026-10-01: L10 S3 intro only before Google's form, L11 never strand a finished run, L12 S15 parity, L13 English debug texts, L14 skills win on code detail, owner placeholders fail the completeness and ship gates, the fa/ckb review is never a gate) | Workflow step 4, and whenever a choice seems to belong to the owner |
| `scripts/spec-lookup.mjs` | Prints the exact spec entry for IDs (`S9 8.3 N3 D4 line-siege line-siege-rules`), `--list` for all; fails on unknown IDs | Workflow step 1, whenever a spec line is quoted |
| `scripts/check-spec-refs.mjs` | Checks every spec citation in the repo, screen name/ID pairs and app folder names | Workflow step 7 and the definition of done |
| `scripts/lib/spec-ids.mjs` | Reads the spec entries from the reference headings (shared by both scripts) | Never by hand |
| `scripts/selftest.mjs` | Proves both scripts pass good fixtures and catch each planted bug | After changing a script or a reference heading |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs for the self-test | When adding a rule to a checker |

## Related skills

- `pocket-arcade-index` - which skill to load for a task and the build order.
- `toybox-screens` - how each screen S1-S15 is laid out and built.
- `toybox-visual-parity` - proves a built screen matches its design screenshot.
- `new-game-scaffold` - creates `apps/<game-id>` for a catalogue game.
- `tdd-workflow` - turns a quoted spec line into a failing test, then code.
- `git-commits-and-reporting` - how to ask the owner and report with spec IDs.
