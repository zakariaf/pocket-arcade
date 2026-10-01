__ONE_SENTENCE_OUTCOME_IN_PLAYERS_WORDS__.

Please say "ship" when TestFlight build __BUILD__ may go to App Review (step R1). Until then it stays on TestFlight and I keep working on __OTHER_WORK__.

Evidence: __GAME_ID__ release __VERSION__ on __YYYY_MM_DD__, commit __SHA__

Checks
- Types, lint, format: pass
- Tests: __PASSED__/__TOTAL__ pass (unit __UNIT_COUNT__, golden __GOLDEN_COUNT__), random seed __SEED__
- Coverage: lines __LINES__% (gate 90), logic folders __LOGIC__% (gate 95)   reports/coverage/coverage-summary.json
- Mutation: __SCORE__% (break 75), survivors explained under Details   reports/stryker/mutation.html
- Bots: __ONE_SUMMARY_PER_DIFFICULTY__   reports/sim/__GAME_ID__.json
- End-to-end: __FLOWS_PASSED__/__FLOWS_TOTAL__ flows pass, quarantined: __NONE_OR_LIST__   reports/e2e/__GAME_ID__/junit.xml
- Network: 0 JS attempts, no non-loopback sockets   reports/e2e/__GAME_ID__/network.txt
- Screenshots: __CAPTURED__ captured, __CHANGED__ changed (all intended)   reports/screenshots/index.html
- Design match: __SCREENS__ match their Toybox design screenshots in en and fa, light and dark (__WAIVER_COUNT__ waivers)   parity/signoff.json

What changed for players
- __ONE_LINE_PER_BEHAVIOUR_IN_THE_SPECS_WORDS__

Please look at (at most 5)
- __GALLERY_ROW__, because __REASON__

Goldens and baselines changed on purpose
- __FILE__: __REASON__ (Gate-Change trailer in __SHA__), or "none"

Owner steps (not blocking)
- Play-test __GAME_NAME__ on TestFlight build __BUILD__, with the purchase test: buy, cancel, restore after reinstall (step G6)
- Listen to the __SOUND_COUNT__ __GAME_NAME__ sound previews in reports/sfx/__GAME_ID__/ and feel the haptics on your phone (step G9)
- Review the fa and ckb texts: __PENDING_TEXTS_OR_NONE_PENDING__ (step R3)

Not tested or not verified
- Sound, haptics and 120 Hz on a phone: your play-test and listening above (G6, G9)
- Purchase on TestFlight: buy, cancel, restore after reinstall (G6)
- VoiceOver spot check (R2)
- __ANYTHING_ELSE_THAT_DID_NOT_RUN__ (a keyless rehearsal, check-store-artifact --unsigned, belongs here and never under Checks)

Details
- Mutation survivors: __EACH_SURVIVOR_AND_WHY__
- The gallery is open: reports/screenshots/index.html
