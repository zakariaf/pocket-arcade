Line Siege now plays its six sounds and a pulse when a wave hits the wall, and the win and lose moments sound and buzz once each.

Evidence: line-siege slice on 2026-09-30, commit 3f9c2a1

Checks
- Types, lint, format: pass
- Tests: 38/38 pass (unit 38, golden 0), random seed 20931
- Sound banks: check-sound-banks PASS, six previews rendered (from reports/sfx/line-siege/)

What changed for players
- Placing a guard, a beam, a shock, a hit, a pop and a breach each have their own short sound (spec 8.7), quiet enough to repeat.
- Winning a level plays the win jingle with a success pulse; losing plays the lose sound with a warning pulse.

Owner steps (not blocking)
- fa and ckb texts: none pending from this slice
- Play-test Line Siege: still open, whenever suits you (step G6)
- Listen to the Line Siege sound previews in reports/sfx/line-siege/ and feel the pulses on an iPhone: pending, six new sounds; tuning follows your answer whenever it comes (step G9)

Not tested or not verified
- How the sounds sound and how the pulses feel: only the owner can judge (listed above). The simulator run only proves that the app asked for the win sound and the success pulse.

Details
- Commit: 3f9c2a1 feat(line-siege): add the six-sound bank and the win and lose feedback
