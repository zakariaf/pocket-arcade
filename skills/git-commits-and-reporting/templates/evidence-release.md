__ONE_SENTENCE_OUTCOME_IN_PLAYERS_WORDS__.

Please play TestFlight build __BUILD__ and answer "ship" or "don't ship" (step R1). Until then I keep working on __OTHER_WORK__.

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

Not tested or not verified
- Sound, haptics and 120 Hz: need your phone (TestFlight play-test, R1)
- Purchase on TestFlight: buy, cancel, restore after reinstall (G6)
- VoiceOver spot check (R2) and the native-speaker read of changed fa/ckb texts (R3)

Details
- Mutation survivors: __EACH_SURVIVOR_AND_WHY__
- The gallery is open: reports/screenshots/index.html
