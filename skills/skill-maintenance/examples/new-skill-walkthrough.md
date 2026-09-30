# Worked example: adding a skill, then updating one

Two real runs with the commands and the output they printed (2026-09-28, in a scratch copy of the repo). Part A adds a new skill end to end; Part B updates an existing skill after its project source changed. In the commands, `<new>` stands for the new skill's folder (the skills folder plus `store-listing-texts`) and `<maint>` for this skill's folder; everything runs from the repo root.

## Contents

- Part A: a new skill, store-listing-texts
- Part B: updating a skill after a source changed

## Part A: a new skill, store-listing-texts

The task: "App Review must never reject a build for its listing; add a skill that checks the App Store texts." The name is new, kebab-case, not a bundled command, and no existing skill owns the job (the release skill uploads, the i18n skill owns in-app copy).

**1. Scaffold.**

```text
$ node <maint>/scripts/new-skill.mjs store-listing-texts --skills-root skills
created <new> (7 files)
next: node skills/_library/sync-shared.mjs <name>, fill every __FILL_...__, then validator, self-test and check-skill.mjs
new-skill: 7 scaffold files checked, 0 problems
RESULT: PASS
$ node skills/_library/sync-shared.mjs store-listing-texts
RESULT: PASS
```

**2. Fill every placeholder.** The scaffold passes the validator as it is (its structure is complete) but `check-skill.mjs` lists every `__FILL_...__` left, so nothing half-written can ship. What was written:

- The description, 267 characters, verb first, trigger words, and two hand-offs:
  `Checks App Store listing texts (name, subtitle, description, keywords, What's New) of each Pocket Arcade game for prices and other platforms. Use when writing or changing store texts. Not for in-app copy (i18n-strings-and-catalogs) or uploads (ios-release-testflight).`
- Two rules, each with its reason: "**No prices in any listing text.** Prices differ per storefront and change; Apple rejects metadata that states them (guideline 2.3.7)." and "**No other platforms.** Naming Android or Google Play in an iOS listing breaks guideline 2.3.10 and blocks the release."
- The reference renamed to `references/listing-rules.md` (field limits, the two guidelines, a worked example), with the Files table and workflow step 1 updated to the new name.
- The checker's rules in `scripts/check-rules.mjs`: `include: ['*.txt']`, `no-price` with `/[€$£]\s?\d|\d+[.,]\d{2}\s?(?:€|EUR|USD|\$)/`, `no-other-platform` with `/\b(?:Android|Google Play)\b/i`, and plain-text files scanned without comment masking.
- Fixtures from real listing text: `good/` (a clean English description), `bad-price/` ("Premium ohne Werbung für nur 1,99 €.", EXPECT `[no-price]` and `apps/line-siege/store/de/description.txt:1`), `bad-other-platform/` ("Also on Google Play.", EXPECT `[no-other-platform]` and the file at line 2). The scaffold's example fixtures were deleted.

**3. Prove it.**

```text
$ node skills/_library/validate-skills.mjs store-listing-texts
PASS  store-listing-texts
RESULT: PASS
$ node <new>/scripts/selftest.mjs
ok   check-rules.mjs --help
ok   check-rules.mjs bad-other-platform (exit 1, found "[no-other-platform]", "apps/line-siege/store/en/description.txt:2")
ok   check-rules.mjs bad-price (exit 1, found "[no-price]", "apps/line-siege/store/de/description.txt:1")
ok   check-rules.mjs good (exit 0)
RESULT: PASS
$ node <maint>/scripts/check-skill.mjs <new>
check-skill: 11 files checked, 0 problems
RESULT: PASS
```

The first `check-skill.mjs` run, in a folder without the i18n skill, failed with `[desc-neighbours] "Not for" names i18n-strings-and-catalogs, which is not a skill`: hand-offs are checked against the real set, so run it in the repo's `skills/`.

**4. Check the set and the routing.**

```text
$ node <maint>/scripts/check-skill-set.mjs skills
listing: 44 skills, 14063 of 20000 characters
FAIL pocket-arcade-product-spec/SKILL.md:3 [not-for-unknown] "Not for" hands off to pocket-arcade-index, which does not exist
$ node <maint>/scripts/check-routing.mjs --skills-root skills --prompt "write the German App Store description and keywords for Line Siege" --expect store-listing-texts
ok   --prompt store-listing-texts #1
RESULT: PASS
$ node <maint>/scripts/check-routing.mjs --skills-root skills --skip-missing
check-routing: 86 evals (offline, top 3) checked, 0 problems
RESULT: PASS
```

The one set problem belonged to a skill still being built (the index), not to the new skill, so it went into the report instead of being "fixed". The new description did not steal any other skill's eval prompts. Two prompts for the new skill were added to `assets/routing-evals.json`.

**5. Record, link, report.** `node skills/_library/record-sources.mjs store-listing-texts references/listing-rules.md <the project file the guideline text came from>`, then `node skills/_library/selftest-all.mjs store-listing-texts`, then `node skills/_library/link-skills.mjs` (the owner approves the write under `.claude/`). Report: the skill, its description, what the checker checks, and the four RESULT lines.

## Part B: updating a skill after a source changed

In a scratch copy of the repo, one row was appended to handbook chapter 14 (the release failure table), then `node skills/_library/check-staleness.mjs troubleshooting-playbook` printed (project path shortened here):

```text
STALE troubleshooting-playbook (16 files, 5 problems)
stale skills: troubleshooting-playbook
FAIL troubleshooting-playbook/assets/known-failures.json [stale-source] source <handbook chapter 14> changed since 2026-09-28 Fix: Re-copy the changed knowledge into troubleshooting-playbook/assets/known-failures.json (for _library shared data: node skills/_library/refresh-shared.mjs), then run record-sources.mjs.
FAIL troubleshooting-playbook/references/build-and-simulator.md [stale-source] ...
FAIL troubleshooting-playbook/references/diagnosing-new-failures.md [stale-source] ...
FAIL troubleshooting-playbook/references/open-risks.md [stale-source] ...
FAIL troubleshooting-playbook/references/release-and-signing.md [stale-source] ...
check-staleness: 97 sources checked, 5 problems
RESULT: FAIL (5 problems)
```

One chapter feeds five files of that skill, so all five are listed. The update:

1. Read what changed in the source (`git diff` of the chapter): one new row in the release failure table.
2. Re-copy it the way the skill wants it. This skill's catalogue is JSON rendered into references, so the row becomes one new entry in `assets/known-failures.json`, and `check-catalogue.mjs --write` re-renders the area tables. The one hand-written file among the five (diagnosing-new-failures.md) is re-read and changed only if the new row changes what it says. Never edit a generated file, and never re-record without re-copying.
3. Record each of the five files again with the same source lists as before (`node skills/_library/record-sources.mjs troubleshooting-playbook <file> <its sources>`), so the new hash is stored.
4. Rerun the four library steps (sync-shared, validate-skills, selftest-all, link-skills --check), `check-staleness.mjs troubleshooting-playbook`, and `check-skill.mjs` on the troubleshooting-playbook folder; all print `RESULT: PASS`.
