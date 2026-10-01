# Pocket Arcade epics

These 43 epics take Pocket Arcade from an empty repo to 26 games. They build the Shell with the pilot game Line Siege, release it to TestFlight, port it to Android, and then build the other 25 games one by one. Each game goes to TestFlight and to Google Play internal testing.

To run an epic, tell Claude Code which one, for example: **"Do epic E05"**. Claude reads `epics/E05-services-and-stores.md`, loads the skills listed under "Skills to load", checks that the previous epic is merged, and works through the tasks in order. When it is done, it gives you a short evidence report.

## The owner's rules (every epic)

1. **One branch per epic.** Each epic has its own branch (`epic/eNN-<slug>`, named at the top of its file), created from `main`. When the epic closes, the branch is merged into `main` with `--no-ff` and then deleted.
2. **Test first.** Write the test first and watch it fail for the right reason. Then write the least code that makes it pass, then tidy up. Never weaken a test to make it pass.
3. **Screens match the design.** A task that builds or changes a screen is not done until the screen matches its Toybox design screenshot. That means every frame (light and dark, English and Persian), checked with toybox-visual-parity, with the sign-off check passing.
4. **/simplify and /code-review before merging.** After the last code task, run `/simplify` and then `/code-review` over the whole branch. Fix every confirmed finding test-first, run `npm run verify` again, and only then merge.

Also in every epic:

- Your steps never block the work. Claude asks once, with a default that applies in the meantime, and keeps going.
- Nothing is pushed to `origin` and nothing is uploaded until you give the word.

## The epics

Phases: **1** Shell foundations (Shell steps 1-8) · **2** Shell screens (step 9) · **3** proving the pilot and releasing it on iOS (steps 10-12) · **4** the Android port · **5** games 2 to 26.

"Only if" means Claude asks only when that problem actually happens. Any screen task can also ask you about a screen that still differs from its design after three fixes, or that needs a waiver. The table does not repeat that.

| Id | Title | Phase | Depends on | Tasks | Owner steps inside it |
|---|---|---|---|---|---|
| E01 | [Repo foundation and quality gates](E01-repo-foundation.md) | 1 | nothing | 9 | Only if needed: install Xcode 26.6, trust the project folder, approve the new `.claude/settings.json` rules and an `.npmrc` edit |
| E02 | [Game kit and the game contract](E02-game-kit-contract.md) | 1 | E01 | 11 | None (only if a copied template has a defect) |
| E03 | [Line Siege rules, bots and levels](E03-line-siege-rules-levels.md) | 1 | E02 | 14 | Only if the fun test (kill test) fails, or a fix would change a daily board |
| E04 | [Save format and migrations](E04-save-and-migrations.md) | 1 | E03 | 10 | None |
| E05 | [Services behind ports and the state stores](E05-services-and-stores.md) | 1 | E04 | 13 | None |
| E06 | [Languages, right-to-left and navigation basics](E06-languages-rtl-navigation.md) | 1 | E05 | 9 | None (your Persian and Sorani review sheet is listed, not waited for) |
| E07 | [Toybox theme, components, icons and art](E07-toybox-look.md) | 1 | E06 | 13 | None |
| E08 | [Line Siege board, gestures, sound and haptics](E08-line-siege-board.md) | 1 | E07 | 9 | Listen to the six sound previews (G9), not blocking |
| E09 | [Game host, composition root and boot](E09-host-root-boot.md) | 1 | E08 | 16 | None |
| E10 | [Native composer, plugins and the first Release simulator build](E10-native-first-build.md) | 1 | E09 | 9 | Only if Xcode 26.6 is missing, or the network audit finds something new |
| E11 | [First run: S1 Splash, S2 Language choice, S3 Ad consent and tracking](E11-first-run-screens.md) | 2 | E10 | 7 | Only if Java 17 or the iOS 26.5 simulator runtime is missing |
| E12 | [Home and play: S4 Home, S5 Game, S6 Pause, S7 Result](E12-home-and-play.md) | 2 | E11 | 8 | Play-test the drag, one-handed play and 120 Hz (not blocking) |
| E13 | [Levels, Daily challenge and Statistics: S8, S9, S10](E13-levels-daily-stats.md) | 2 | E12 | 5 | None beyond screen questions |
| E14 | [Settings and its pages: S11, S11a, S11b, S11c, S11d](E14-settings-pages.md) | 2 | E13 | 8 | None beyond screen questions (G2 and G3 are listed, not waited for) |
| E15 | [Premium, How to play, Dialogs and Debug: S12, S13, S14, S15](E15-premium-howto-dialogs-debug.md) | 2 | E14 | 7 | None beyond screen questions (G3 and G5 are listed, not waited for) |
| E16 | [End-to-end flows, debug deep link, network guard and the screenshot matrix](E16-e2e-and-screenshots.md) | 3 | E15 | 10 | Only if Java 17 is missing, or a screen needs a waiver or a design answer |
| E17 | [Audits, StoreKit harness and the iOS release to TestFlight](E17-ios-release-pilot.md) | 3 | E16 | 12 | One message: O1-O3, O5, O9 and G1-G5. Your go for the TestFlight upload and the push. Your own checks (play-test with the purchase test, Persian and Sorani texts, sounds, VoiceOver) |
| E18 | [Android port of the Shell and Line Siege to internal testing](E18-android-port.md) | 4 | E17 | 28 | Read the Android plan and its six decisions; approve the writes under `.claude/`; O10 and GP1-GP7; your go for the Play upload. Your own checks (Android play-test, TalkBack, purchase test) |
| E19 | [Flock Tilt: game 2](E19-flock-tilt.md) | 5 | E18 | 24 | Game message; upload go; own checks |
| E20 | [Scrap Shove: game 3](E20-scrap-shove.md) | 5 | E19 \* | 24 | Game message; upload go; own checks |
| E21 | [Snare Snake: game 4](E21-snare-snake.md) | 5 | E20 \* | 24 | Game message + design; upload go; own checks |
| E22 | [Merge Siege: game 5](E22-merge-siege.md) | 5 | E21 \* | 24 | Game message + design; upload go; own checks |
| E23 | [Jump Chain: game 6](E23-jump-chain.md) | 5 | E22 \* | 24 | Game message + design; upload go; own checks |
| E24 | [Stepstone: game 7](E24-stepstone.md) | 5 | E23 \* | 24 | Game message + design; upload go; own checks |
| E25 | [Swap Guard: game 8](E25-swap-guard.md) | 5 | E24 \* | 24 | Game message + design; upload go; own checks |
| E26 | [Toggle Drop: game 9](E26-toggle-drop.md) | 5 | E25 \* | 25 | Game message + design; upload go; own checks |
| E27 | [Poker Drop: game 10](E27-poker-drop.md) | 5 | E26 \* | 25 | Game message + design; upload go; own checks |
| E28 | [Trail Clear: game 11](E28-trail-clear.md) | 5 | E27 \* | 24 | Game message + design; upload go; own checks |
| E29 | [Dig Site: game 12](E29-dig-site.md) | 5 | E28 \* | 25 | Game message + design; upload go; own checks |
| E30 | [Floodline: game 13](E30-floodline.md) | 5 | E29 \* | 25 | Game message + design; upload go; own checks |
| E31 | [Sonar Hand: game 14](E31-sonar-hand.md) | 5 | E30 \* | 25 | Game message + design; upload go; own checks |
| E32 | [Deep Sweep: game 15](E32-deep-sweep.md) | 5 | E31 \* | 25 | Game message + design; upload go; own checks |
| E33 | [Grove Shift: game 16](E33-grove-shift.md) | 5 | E32 \* | 24 | Game message + design; upload go; own checks |
| E34 | [Rank Ladder: game 17](E34-rank-ladder.md) | 5 | E33 \* | 24 | Game message + design; upload go; own checks |
| E35 | [Letter Bugs: game 18](E35-letter-bugs.md) | 5 | E34 \* | 25 | Game message + design; upload go; own checks |
| E36 | [Exact Zero: game 19](E36-exact-zero.md) | 5 | E35 \* | 24 | Game message + design; upload go; own checks |
| E37 | [Dice Foundry: game 20](E37-dice-foundry.md) | 5 | E36 \* | 24 | Game message + design; upload go; own checks |
| E38 | [Fuseban: game 21](E38-fuseban.md) | 5 | E37 \* | 24 | Game message + design; upload go; own checks |
| E39 | [Ripple Ten: game 22](E39-ripple-ten.md) | 5 | E38 \* | 24 | Game message + design; upload go; own checks |
| E40 | [Dock Slide: game 23](E40-dock-slide.md) | 5 | E39 \* | 24 | Game message + design; upload go; own checks |
| E41 | [Last Stop: game 24](E41-last-stop.md) | 5 | E40 \* | 24 | Game message + design; upload go; own checks |
| E42 | [Bank Shot: game 25](E42-bank-shot.md) | 5 | E41 \* | 25 | Game message + design; upload go; own checks |
| E43 | [Halo Drift: game 26](E43-halo-drift.md) | 5 | E42 \* | 25 | Game message + design; upload go; own checks |

\* The previous game epic is either merged, or closed as dropped with its report.

Every game epic (E19-E43) runs from the design notes to a TestFlight build and a Google Play internal-testing build. Its owner steps:

- **Game message:** one message at the start (task T01). It holds the design notes, G1-G8 and GP1-GP7, each with a default. Only the uploads wait for it.
- **+ design:** from E21 on, the game is not yet in the Toybox design. So T01 also draws it there (palette, logo, texts), and the same message asks you to approve it.
- **Upload go:** your word before each upload, before the tag is pushed and before `main` is pushed.
- **Own checks:** the play-test with the purchase test, the Persian and Sorani texts and the sounds. They are listed in the report and never waited for.
- **Only if the fun test (kill test) fails:** you choose between a rule change and dropping the game.

Step ids:

- **G1-G9 (per game):**
  - G1: app name
  - G2: App Store Connect record
  - G3: App Privacy answers, privacy link and support address
  - G4: check the Premium product
  - G5: AdMob ids
  - G6: TestFlight play-test
  - G7: Persian and Sorani review
  - G8: store listing (listed only)
  - G9: sound previews
- **GP1-GP7 (per game, Google Play):**
  - GP1: Play Console app
  - GP2: app signing
  - GP3: service account
  - GP4: App content and Data safety
  - GP5: AdMob Android ids
  - GP6: Premium product
  - GP7: testers and first upload
- **O1-O10 (account-wide setup steps):**
  - O1: Apple agreements
  - O2: EU trader status
  - O3: App Store Connect API key
  - O5: TestFlight on your iPhone
  - O9: AdMob account and consent message
  - O10: Google Play developer account

  These setup steps are not the owner decisions O1-O6 in `docs/99-final-decisions.md`.

## Order

Run the epics in number order, E01 to E43. **No two epics run in parallel.** Each epic depends on the one before it, so the next one starts only after the previous one is merged into `main` (a game epic may also start after the previous game was dropped). The reasons:

- E01-E18 build the Shell layer by layer, and each epic uses what the previous one made.
- The spec builds the games one at a time (spec 0). Every game epic puts its Shell and game-kit improvements into the shared packages, so they reach every app, and proves that all earlier apps are still green (its "Keep every earlier app green" task). Two game branches at the same time would change the same shared packages.

What does run in parallel is your side. Your store steps (E17-T01, E18-T11, each game's T01) go on while Claude keeps working. Only the uploads wait for them.

## Totals

**43 epics, 807 tasks.**

| Phase | Epics | Tasks |
|---|---|---|
| 1 Shell foundations | E01-E10 | 113 |
| 2 Shell screens | E11-E15 | 35 |
| 3 Pilot proof and iOS release | E16-E17 | 22 |
| 4 Android port | E18 | 28 |
| 5 Games 2-26 | E19-E43 | 609 |

## Not in these epics

- **Store web pages** (pipeline step 8).
- **Publishing to the App Store and Google Play** (pipeline step 9).

The release epics stop at a TestFlight build for iOS and an internal-testing build for Android. The store listing (G8) is only listed. Your play-tests, the Persian and Sorani text review and listening to the sounds are your own checks, never tasks that block.
