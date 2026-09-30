PRAGMA journal_mode = DELETE;
PRAGMA synchronous = FULL;
CREATE TABLE save_slots (
  slot TEXT PRIMARY KEY NOT NULL CHECK (slot IN ('current', 'backup')),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  app_version TEXT NOT NULL,
  written_at INTEGER NOT NULL,
  write_count INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  payload TEXT NOT NULL
) STRICT;
CREATE TABLE save_quarantine (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quarantined_at INTEGER NOT NULL,
  slot TEXT NOT NULL,
  reason TEXT NOT NULL,
  schema_version INTEGER,
  payload TEXT
) STRICT;
PRAGMA user_version = 1;
INSERT INTO save_slots VALUES ('current', 1, '1.0.0', 1790000000000, 7, '11926b41', '{"schemaVersion":1,"gameId":"line-siege","settings":{"language":"ckb","digits":"local","soundEnabled":true,"soundVolume":80,"musicEnabled":true,"musicVolume":60,"vibrationEnabled":true,"theme":"dark","colorBlind":false,"reduceMotion":"on","hintsDuringPlay":true},"firstRun":{"languageChosen":true,"tutorialDone":true},"progress":{"levels":{"1":{"stars":3,"bestScore":420,"bestMoves":7,"completions":2,"firstCompletedOn":"2026-09-20"},"2":{"stars":1,"bestScore":90,"bestMoves":null,"completions":1,"firstCompletedOn":"2026-09-21"}},"endlessBest":4210},"run":{"ref":{"kind":"level","level":3},"seed":123456789,"difficulty":12,"stateVersion":1,"state":{"seed":1,"moves":2,"score":0},"log":[{"kind":"move","move":{"column":0}},{"kind":"move","move":{"column":0}}],"moveCount":2,"undoCount":0,"hintsUsed":1,"continuesUsed":0,"playMs":83000,"resumeOnLaunch":true},"daily":{"results":{"2026-09-25":{"won":true,"score":300,"moves":11,"playMs":120000},"2026-09-26":{"won":false,"score":80,"moves":5,"playMs":40000}},"completed":7,"streak":{"lastDate":"2026-09-26","length":2},"bestStreak":5},"stats":{"gamesPlayed":12,"wins":9,"losses":3,"playMs":1804000,"bestScore":{"level":420,"daily":300,"endless":4210},"currentWinStreak":0,"longestWinStreak":6,"days":{"2026-09-25":{"games":4,"playMs":600000},"2026-09-26":{"games":2,"playMs":160000}},"counters":{"blocks-placed":311}},"hints":{"freeDate":"2026-09-26","freeUsed":1},"ads":{"history":{"lastInterstitialAtMs":1790000000000,"levelsCompletedSinceInterstitial":1,"didLastInterstitialFollowLoss":false},"consent":{"canRequestAds":true,"isPrivacyOptionsRequired":true}},"premium":{"owned":true,"ownedSinceMs":1790000500000,"lastCheckedAtMs":1790000600000,"revokedAtMs":null},"upsell":{"lastShownOn":"2026-09-24"}}');
INSERT INTO save_slots VALUES ('backup', 1, '1.0.0', 1790000000000, 7, '11926b41', '{"schemaVersion":1,"gameId":"line-siege","settings":{"language":"ckb","digits":"local","soundEnabled":true,"soundVolume":80,"musicEnabled":true,"musicVolume":60,"vibrationEnabled":true,"theme":"dark","colorBlind":false,"reduceMotion":"on","hintsDuringPlay":true},"firstRun":{"languageChosen":true,"tutorialDone":true},"progress":{"levels":{"1":{"stars":3,"bestScore":420,"bestMoves":7,"completions":2,"firstCompletedOn":"2026-09-20"},"2":{"stars":1,"bestScore":90,"bestMoves":null,"completions":1,"firstCompletedOn":"2026-09-21"}},"endlessBest":4210},"run":{"ref":{"kind":"level","level":3},"seed":123456789,"difficulty":12,"stateVersion":1,"state":{"seed":1,"moves":2,"score":0},"log":[{"kind":"move","move":{"column":0}},{"kind":"move","move":{"column":0}}],"moveCount":2,"undoCount":0,"hintsUsed":1,"continuesUsed":0,"playMs":83000,"resumeOnLaunch":true},"daily":{"results":{"2026-09-25":{"won":true,"score":300,"moves":11,"playMs":120000},"2026-09-26":{"won":false,"score":80,"moves":5,"playMs":40000}},"completed":7,"streak":{"lastDate":"2026-09-26","length":2},"bestStreak":5},"stats":{"gamesPlayed":12,"wins":9,"losses":3,"playMs":1804000,"bestScore":{"level":420,"daily":300,"endless":4210},"currentWinStreak":0,"longestWinStreak":6,"days":{"2026-09-25":{"games":4,"playMs":600000},"2026-09-26":{"games":2,"playMs":160000}},"counters":{"blocks-placed":311}},"hints":{"freeDate":"2026-09-26","freeUsed":1},"ads":{"history":{"lastInterstitialAtMs":1790000000000,"levelsCompletedSinceInterstitial":1,"didLastInterstitialFollowLoss":false},"consent":{"canRequestAds":true,"isPrivacyOptionsRequired":true}},"premium":{"owned":true,"ownedSinceMs":1790000500000,"lastCheckedAtMs":1790000600000,"revokedAtMs":null},"upsell":{"lastShownOn":"2026-09-24"}}');
