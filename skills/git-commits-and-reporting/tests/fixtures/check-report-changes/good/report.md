The design pictures for Settings, Pause, Result and Levels now show what Line Siege really has: no Music rows, a score line on a win, and whole Persian level numbers.

Evidence: shell slice on 2026-09-30, commit 1a2b3c4

Checks
- Types, lint, format: pass
- Tests: 1745/1745 pass (unit 1680, golden 65), random seed 48213
- Design match: Pause (S6) without music, Result (S7) win with the score line and lose, Levels (S8) light-en and light-fa, Settings (S11) light-en and dark-fa match their Toybox design screenshots (machine gates pass, eye checks signed off, 19 waivers)   parity/signoff.json

What changed for players
- Line Siege has no music, so Settings (S11) and Pause (S6) show no Music rows, as the spec asks for a game without music.
- A won Line Siege level (S7) shows "Score 1,840 – best 1,840" instead of "7 moves – par 7", because its levels are rated by score.
- In Persian and Sorani the level numbers on the Levels screen (S8) are no longer cut off at the top.

Please look at (at most 5)
- The dark fa sheet of Levels (S8), because the Persian digits are now whole.

Design references changed on purpose
- s11-settings--no-music and s6-pause--no-music: new pictures without the Music switch, the Music volume row and the Pause Music key, for games without music (change L1).
- s8-levels light-fa and dark-fa: Persian level numbers now use line height 1.45 instead of 1.0, so the digits are whole (change L2).
- s7-result-win--score: a new picture whose win line reads "Score 1,840 – best 1,840" for score-rated games (change L3).
- s11-settings: the version line lost its 6 pt gap between "Version" and the number, like every other label and value pair (change L5).
- s13-how-to-play: the march text of step 4 changed in the design's texts, and no frame pixels changed because the picture shows step 2 (change L4; the re-render of 2026-09-29 with identical pixels is change P-8).

Parity waivers changed
- Levels (S8): the 17 locked tiles and the locked pack panel, class platform, rule structure, because iOS draws dashed edges with its own dash length (Gate-Change trailer in 7d3e9a1).
- Levels (S8): tile 13, class design-artefact, rules bounds and structure, because the design draws it mid-press (Gate-Change trailer in 7d3e9a1).
- Settings (S11): the version-gap waiver, class design-artefact, retired because the design is fixed (Gate-Change trailer in 8c2f4b0).

Texts changed in all four languages
- Line Siege how-to-play step 4 and tutorial step 4 (en, de, fa, ckb): en now reads "The monsters march closer every few blocks." and "Careful: the monsters march closer every few blocks."; de, fa and ckb changed with it, and fa and ckb wait for a native speaker's review (R3).
- The win line of score-rated levels (en, de, fa, ckb): en reads "Score 1,840 – best 1,840"; the fa and ckb drafts wait for a native speaker's review (R3).

Not tested or not verified
- The new fa and ckb texts need a native speaker (R3).
- Sound and haptics on Pause need your phone.

Details
- Reference manifest: the referenceChanges entries P-8, L1, L2, L3, L4 and L5, dated 2026-09-30 and approved by the lead.
- Waivers: parity/waivers.json in 7d3e9a1 and 8c2f4b0, each with a Gate-Change trailer.
