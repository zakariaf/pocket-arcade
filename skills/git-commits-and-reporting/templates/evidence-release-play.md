__ONE_SENTENCE_OUTCOME_IN_PLAYERS_WORDS__.

Please say "ship" when build __BUILD__ may leave Google Play internal testing; promoting it in the Play Console is your step. Until then it stays on the internal track and I keep working on __OTHER_WORK__.

Evidence: __GAME_ID__ release __VERSION__ on __YYYY_MM_DD__, commit __SHA__

Checks
- Types, lint, format: pass
- Tests: __PASSED__/__TOTAL__ pass (unit __UNIT_COUNT__, golden __GOLDEN_COUNT__), random seed __SEED__
- Coverage: lines __LINES__% (gate 90), logic folders __LOGIC__% (gate 95)   reports/coverage/coverage-summary.json
- Mutation: __SCORE__% (break 75), survivors explained under Details   reports/stryker/mutation.html
- Bots: __ONE_SUMMARY_PER_DIFFICULTY__   reports/sim/__GAME_ID__.json
- End-to-end: __FLOWS_PASSED__/__FLOWS_TOTAL__ flows pass on the Android emulator, quarantined: __NONE_OR_LIST__   reports/e2e-android/__GAME_ID__/junit.xml
- Network: 0 JS attempts, no non-loopback sockets   reports/e2e-android/__GAME_ID__/network.txt
- Screenshots: __CAPTURED__ captured on the Android emulator, __CHANGED__ changed (all intended)   reports/screenshots/index.html
- Design match: __SCREENS__ match their Toybox design screenshots on Android in en and fa, light and dark (__WAIVER_COUNT__ waivers)   parity/signoff.json
- Store AAB gate: versionCode __BUILD__ (the shared build number), signed with the upload key, no test code, target SDK 36   apps/__GAME_ID__/build/release/aab-gate.json

What changed for players
- __ONE_LINE_PER_BEHAVIOUR_IN_THE_SPECS_WORDS__

Please look at (at most 5)
- __GALLERY_ROW__, because __REASON__

Goldens and baselines changed on purpose
- __FILE__: __REASON__ (Gate-Change trailer in __SHA__), or "none"

Owner steps (not blocking)
- Play-test __GAME_NAME__ from the internal track, build __BUILD__, with the purchase test as a license tester: buy, cancel, pending, restore after a reinstall (step GP7)
- Listen to the __SOUND_COUNT__ __GAME_NAME__ sound previews in reports/sfx/__GAME_ID__/ and feel the haptics on your phone (step G9)
- Review the fa and ckb texts: __PENDING_TEXTS_OR_NONE_PENDING__ (step R3)

Not tested or not verified
- Sound, haptics and 120 Hz on a phone: your play-test and listening above (GP7, G9)
- Purchase from the internal track: buy, cancel, pending, restore after a reinstall (GP7)
- TalkBack spot check on a phone
- __ANYTHING_ELSE_THAT_DID_NOT_RUN__ (a keyless rehearsal, check-store-aab --unsigned, belongs here and never under Checks)

Details
- Mutation survivors: __EACH_SURVIVOR_AND_WHY__
- The gallery is open: reports/screenshots/index.html
