A finished puzzle level now earns 3 stars at or under par, 2 stars up to par + 2 and 1 star otherwise.

Evidence: game-kit slice on 2026-09-28, commit 5d64fbf

Checks
- Types, lint, format: pass
- Tests: 11/11 pass (unit 11, golden 0), random seed 48213

What changed for players
- The Result screen (S7) can now show 1-3 stars from the moves and par (spec 8.1).

Owner steps (not blocking)
- fa and ckb texts: none pending from this slice
- Play-test Line Siege: still open, whenever suits you (step G6)
- Listen to the Line Siege sound previews in reports/sfx/line-siege/: still open (step G9)

Not tested or not verified
- Nothing device-specific in this slice: the stars are pure logic and are not on screen yet.

Details
- Red run: Expected: 3, Received: 1 (starsForMoves(7, 7) before the rule existed)
- Commit: 5d64fbf feat(game-kit): give stars for moves against par
