# Worked example: S8 Levels in English and Persian, with pre-listed waivers

The parity loop for S8 on the pilot (Line Siege, a partial Shell with S8 in `shell-slice.json`), from the round-3 proof run of 2026-09-30. It shows the parts S4 does not: a frame state opened by a model hook, the frozen-motion switch, Persian level numbers at line height 1.45, and the pre-listed waivers for dashed edges and the mid-press tile. Commands run from the app repo root; `$S` stands for `${CLAUDE_SKILL_DIR}/scripts`. A second session on the same Mac used its own simulator and driver port.

## 1. What must be in place

- The harness templates, `parity/game-facts.json` and `parity/waivers.json` copied from `templates/parity/` (the waivers file holds the pre-listed entries). `node $S/check-harness.mjs .` passes, or prints SKIP lines for screens outside the slice.
- The Levels model hook opens `levels-locked-tile-tapped` once on mount (it taps the first locked tile through the tile's own handler: focus ring on tile 13 and the toast). The current tile's flag bob holds still because `useReduceMotion()` is true while `isParityMotionFrozen()` is.
- The Toybox type role `levelNumber` uses line height 1.45 for Persian (1.0 clips Vazirmatn's digits on iOS; lead decision L2, re-rendered on 2026-09-30).

## 2. Capture and check

```sh
node $S/setup-parity-sim.mjs --appearance light --name e07-r3-parity
xcrun simctl install <udid> <path to>/LineSiege.app
node $S/run-parity.mjs --frame s8-levels --themes light --langs en,fa --bundle-id com.example.linesiege --name e07-r3-parity --driver-port 22513
```

```
frame s8-levels: reference s8-levels (base)
s8-levels light-en                       PASS
s8-levels light-fa                       PASS
run-parity: 2 runs checked, 0 problems
RESULT: PASS
```

S8 has no reference variants, so no facts are read ("reference s8-levels (base)"). Each run checked bounds 48, text 9, fill 36, border 14, text ink 38 (en) and 52 (fa), structure 36. Twenty problems per run were waived, all pre-listed, and `check-parity.mjs` prints them as notes:

```
WAIVED [structure] levels.level-tile.14: shape differs: a 2.0 pt thick difference ... (waiver 1, platform: React Native on iOS draws a dashed border with its own dash length and corner phase ...)
... tiles 15 to 30 and levels.pack.2 the same ...
WAIVED [bounds] levels.level-tile.13: geometry off ... (waiver 20, design-artefact: The frame draws tile 13 frozen mid-press ...)
WAIVED [structure] levels.level-tile.13: ... (waiver 21, design-artefact)
```

Without the pre-listed entries the same problems fail, and the fix text points at them: "This element has a pre-listed platform waiver (React Native's iOS dash pattern): when its crop shows only that, copy the entry from the skill's templates/parity/waivers.json". Open one crop first (`crops/levels.level-tile.14.png`): the edge is there, dashed, the same width and colour; only the dashes sit elsewhere. That is the waiver's cause and nothing else, so the entry stays.

The Persian level numbers pass `text-ink` with the same ink height as the design (`dh 0` for tiles 1 to 12 in `report.json` `stats.textInk`). Before L2 they measured 10 pt against 14 pt: the tops of the digits were clipped.

## 3. Look

Read every image each run lists in `sheets.json` (sheet, four zoom bands, four eye pages). What to confirm on S8:

- `sheet.png`: same blocks in the same order; the banner is the stand-in in the app and the placeholder in the design (masked, hatched).
- zoom bands: the Persian digits are whole; the mini stars sit a little lower in fa than in en (the taller number box); tile 13 is at rest in the app with its focus ring while the design draws it squashed mid-press; the dashed edges differ only in dash phase.
- eye pages: back arrow, the pack star, the progress bar, the stars of every tile, the lock icons, the flag sticker on tile 12.

## 4. Record and prove

```sh
node $S/check-signoff.mjs --draft .parity/lineSiege/s8-levels/light-fa
```

Fill in the eye checks (`feel` is `waived: ...` naming the dash phase and the mid-press tile, both pre-listed) and the differences (`"status": "waived"` for those two, `"fixed"` for anything fixed on the way), add the entry to `parity/signoff.json` for both runs, then:

```sh
node $S/check-signoff.mjs --frame s8-levels --themes light --langs en,fa
```

```
reference s8-levels (base)
  intended reference change P-8 (2026-09-29): Every layout.json and the manifest were re-rendered ...
  intended reference change L2 (2026-09-30): The Persian level numbers of S8 use line height 1.45 ...
s8-levels                        light-en done | light-fa done
waiver 1 [platform] s8-levels levels.level-tile.14 structure: platform limit; owner told 2026-09-30
...
waiver 21 [design-artefact] s8-levels levels.level-tile.13 structure: mockup CSS .lt.is-pressed{...}; owner told 2026-09-30
check-signoff: 2 frame variants checked, 0 problems
RESULT: PASS
```

The report to the owner names both intended reference changes, the 20 pre-listed waivers with their two causes, the open design question (keep the mid-press tile, or draw it at rest and re-render), and attaches the light fa `sheet.png`. Dark mode follows the same loop (`--themes dark`).
