Line Siege can now be played end to end on the simulator: levels, the daily level, endless mode and the continue all work in four languages.

Evidence: line-siege slice on 2026-10-01, commit fbe703a

Checks
- Types, lint, format: pass
- Tests: 2274/2274 pass (unit 2209, golden 65), random seed -229573507

What changed for players
- Levels show their stars on Levels (S8) and the next level opens after a win (spec 8.1).
- The daily level (S9) and endless mode (spec 8.4) keep their best scores.

Owner steps (not blocking)
- fa and ckb texts: the Line Siege lose and progress lines are drafts for your review (step R3)
- Play-test Line Siege: still open, whenever suits you (step G6)
- Listen to the six Line Siege sound previews in reports/sfx/line-siege/ (step G9)
- G3: the privacy-policy host and support address; until then the ship gates end with OWNER STEPS PENDING: G3, G5
- G5: the real AdMob app id and its three units, which the live store build needs

Not tested or not verified
- Release: no upload yet. The keyless rehearsal of a store/off archive printed REHEARSAL: not a release gate and failed only on owner-placeholder lines (OWNER STEPS PENDING: G3, G5); the release report follows the first upload.

Details
- check-store-artifact --unsigned and audit-app-bundle --unsigned: only owner-placeholder lines (example.com, support@example.com).
