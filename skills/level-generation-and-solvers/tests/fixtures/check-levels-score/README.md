# check-levels self-test fixtures: a score-rated table

The same good repo as `check-levels/` (templates, base, generated packs), with `score.json`
applied before the packs are generated: the plan's `rate()` returns
`{ kind: 'score', thresholds: [0, par * 10, par * 12] }`, so every pack entry carries a threshold
array, which Prettier writes on one line. The bad cases plant a pack written in plain
`JSON.stringify` layout (`pack-format`) and a hand-edited threshold (`pack-stale`).
