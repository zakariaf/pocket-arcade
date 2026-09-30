Line Siege 1.0.0 is ready for your play-test: every screen works in all four languages, levels save after every move, and ads never interrupt play.

Please play TestFlight build 8 and answer "ship" or "don't ship" (step R1). Until then I keep working on the Flock Tilt rules.

Please also create the Flock Tilt app record (step G2). Until then I keep working on the board.

Evidence: line-siege release 1.0.0 on 2026-10-20, commit 9f3c2ab

Checks
- Types, lint, format: pass
- Tests: 612/612 pass (unit 571, golden 41), random seed 90211
- Coverage: lines 93.4% (gate 90), logic folders 97.1% (gate 95)   reports/coverage/coverage-summary.json
- Mutation: 84% (break 75), survivors explained under Details   reports/stryker/mutation.html
- Bots: easy wins 96%, medium 71%, hard 38% of 2,000 runs each   reports/sim/line-siege.json
- End-to-end: 14/14 flows pass, quarantined: none   reports/e2e/line-siege/junit.xml
- Network: 0 JS attempts, no non-loopback sockets   reports/e2e/line-siege/network.txt
- Screenshots: 180 captured, 12 changed (all intended)   reports/screenshots/index.html
- Design match: every screen (S1-S15) matches its Toybox design screenshot in en and fa, light and dark (0 waivers)   parity/signoff.json

What changed for players
- Endless mode keeps the best score on Home (S4) and in Statistics (S10).
- The daily challenge (S9, spec 8.3) gives every phone the same level for the same date.
- A full-screen ad appears only after tapping Next, Replay or Try again, at most once every 3 minutes (spec 8.8).

Please look at (at most 5)
- Gallery row "fa-dark / Levels (S8)", because level 1 now sits at the top right.
- Gallery row "de-light / Premium (S12)", because the price line wraps at 200% text.

Goldens and baselines changed on purpose
- apps/line-siege/e2e/baselines: 12 screenshots after the Toybox button update (Gate-Change trailer in 7a1b2c3)

Not tested or not verified
- Sound, haptics and 120 Hz: need your phone (TestFlight play-test, R1)
- Purchase on TestFlight: buy, cancel, restore after reinstall (G6)
- VoiceOver spot check (R2) and the native-speaker read of changed fa/ckb texts (R3)

Details
- Mutation survivors: 3 in the monster march timer, equivalent mutants (a zero-step march changes nothing).
- The gallery is open: reports/screenshots/index.html
