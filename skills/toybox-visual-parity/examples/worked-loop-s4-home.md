# Worked example: taking S4 Home to sign-off

The parity loop for one screen, from a fresh build to a passing `check-signoff.mjs`. Commands run from the app repo root; `$S` stands for `${CLAUDE_SKILL_DIR}/scripts`. The failure outputs below are the real outputs of this skill's planted-defect fixtures (the gear icon left out; the hero key 4/255 too green).

## 1. Tooling and simulator (once per session)

```sh
npm ci --prefix "$S"                                  # pinned pngjs, pixelmatch, playwright; no browser download
node $S/selftest.mjs                                  # RESULT: PASS, or the tooling itself is broken: stop
node $S/setup-parity-sim.mjs --appearance light       # creates/boots e07-parity, 9:41 status bar; prints the udid
node $S/check-harness.mjs .                           # RESULT: PASS: harness complete and wired, specs draw the reference edges
```

Build the Release test build and install it on the parity simulator (`ios-simulator-build`). Test and store builds share one bundle id (the scaffold placeholder is `com.example.linesiege` until the owner approves the real one); read it from the built app rather than guessing:

```sh
BUNDLE_ID=$(plutil -extract CFBundleIdentifier raw -o - <path to>/LineSiege.app/Info.plist)
```

## 2. Look at the target

S4 has two frames (`s4-home`, `s4-home-premium`). Read `assets/reference/lineSiege/light-en/s4-home.png` and `dark-fa/s4-home.png` once, and `frames.s4-home.state` in `assets/frames.json`: not Premium, level 12 in progress, streak 5, banner placeholder.

## 3. Run the machine side

```sh
node $S/run-parity.mjs --screen S4 --bundle-id "$BUNDLE_ID"
```

8 runs (2 frames x light, dark x en, fa). One of them failed:

```
s4-home light-en                         FAIL 1 (first: [structure] home.settings-button: shape differs: a 2.7 pt thick difference (21.3 x)
FAIL .parity/lineSiege/s4-home/light-en/app.png [structure] s4-home light-en: home.settings-button: shape differs: a 2.7 pt thick difference (21.3 x 21.3 pt) at +13.3,+13.3 from the element's top-left (2 blobs; border, radius, hard shadow, icon, picture or spacing) Fix: Open crops/<testID>.png from make-sheet.mjs and match the border, radius, hard shadow, icon path or spacing.
```

## 4. Find the real cause before touching code

Read `.parity/lineSiege/s4-home/light-en/crops/home.settings-button.png`: the design shows the gear, the app shows an empty key. The 21 x 21 pt blob 13 pt inside the 48 pt button is exactly the 24 pt icon. Cause: the `IconButton` was rendered without its `gear` icon (the testID map says `kind: "gear"`). Fix it, rebuild (or swap the JS bundle), run again:

```sh
node $S/run-parity.mjs --screen S4 --bundle-id "$BUNDLE_ID"
```

A second loop on another screen found `[fill] ...: fill #FF6F4A but the design is #FF6B4A (max channel difference 4, tolerance 3)`: a hard-coded `#FF6F4A` in a style instead of the theme's `primary` (Toybox accent) colour. The tolerance is not the problem; the colour literal is.

## 5. The look pass

All 8 runs pass. For each run, read `sheet.png`, every `zoom-*.png` and every `eye-*.png` (`sheets.json` lists them). In `dark-fa` the zoom band showed the streak sticker's chain icon mirrored; the design never mirrors it (only back, chevron, forward and undo flip). Fixed (the chain icon was drawn through a mirrored wrapper), re-ran S4, looked again: no difference left.

## 6. Record and prove

For each run:

```sh
node $S/check-signoff.mjs --draft .parity/lineSiege/s4-home/dark-fa
```

After a rebuild that only changed the sheets, add `--from-ledger`: the entry comes with the previous differences of the same run filled in (the eye checks open again).

Paste the printed entry into `parity/signoff.json`, answer every eye check, and record what the look found:

```json
{
 "game": "lineSiege", "frame": "s4-home", "theme": "dark", "lang": "fa", "scrollY": 0,
 "sheetSha256": "<printed by --draft>",
 "date": "2026-09-28",
 "looked": ["sheet.png", "zoom-1.png", "zoom-2.png", "zoom-3.png", "zoom-4.png", "eye-1.png"],
 "eyeChecks": { "icons": "match", "pictures": "match", "shadows": "match", "alignment": "match", "wrapping": "match", "direction": "match", "feel": "match" },
 "differences": [{ "what": "streak chain icon mirrored in RTL", "status": "fixed" }]
}
```

Then:

```sh
node $S/check-signoff.mjs --screen S4
```

```
s4-home                          light-en done | light-fa done | dark-en done | dark-fa done
s4-home-premium                  light-en done | light-fa done | dark-en done | dark-fa done
check-signoff: 8 frame variants checked, 0 problems
RESULT: PASS
```

## 7. Report

"S4 Home matches its design in light and dark, English and Persian (8 captures, 0 problems). Checked by eye: icons, pictures, shadows, alignment, wrapping, direction, feel. Fixed on the way: the settings gear was missing; the streak chain icon was mirrored in Persian. No waivers." Attach `.parity/lineSiege/s4-home/dark-fa/sheet.png`.

(The Persian Stats label آمار is drawn 0.67 pt narrower by iOS than by Chrome, because CoreText shapes the madda shorter; that is inside the 1 pt ink tolerance, so it needs no waiver. Had it gone past, the waiver would be one `platform-text-shaping` entry per frame naming the glyph, as signoff-and-waivers.md shows.)
