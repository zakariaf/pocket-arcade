# Messages that ask the owner for something

Three filled-in requests, one per kind. Each passes `scripts/check-report.mjs <file> --kind request` when saved on its own (without the headings of this page). One request per message, answerable in a word, with the default that applies until the owner answers.

## A human step (from `templates/owner-request.md`)

```text
Flock Tilt cannot be uploaded to TestFlight yet because it has no App Store Connect app record.

Please create the App Store Connect app record for Flock Tilt with the bundle ID com.example.flocktilt (step G2, about 2 minutes). Until then I keep working on the board.
```

## A spec question (from `templates/owner-request.md`)

```text
The spec does not say whether losing today's daily challenge still counts for the streak.

Please answer A or B. Until then I use option A.
- Spec S9: "The first completion of the day counts for the streak and statistics."
- Spec S9: "Streaks follow the plain rule 'played yesterday or today'."
- Option A (my default): the first finished attempt of the day counts, win or lose, because the player played today.
- Option B: only a win counts, and replays may still turn the day into a win.
```

## A release stop (from `templates/release-stop.md`)

```text
The release of Line Siege stopped at the archive step and I have not retried it.

Error: `errSecInternalComponent`

Please unlock the login keychain on the Mac, for example by running security unlock-keychain in Terminal while logged in at the desktop (step O8, about 1 minute). Until then the build stays unsent and I keep working on the Flock Tilt rules; I resume from the archive step once you confirm.
```

## What each part does

| Part | Why |
|---|---|
| First sentence | says what is blocked in plain words, so the owner knows why the message matters |
| One "Please ..." line | one action, the step ID when there is one, and roughly how long it takes |
| "Until then ..." | the default that applies meanwhile, so no answer never blocks everything |
| Quoted spec lines and options (spec questions only) | the owner decides from the spec's own words, with the default marked |
| The exact error line (release stops only) | the owner or a later session can match it to the failure table without guessing |
