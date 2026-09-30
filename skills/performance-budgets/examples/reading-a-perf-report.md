# Worked example: judging the owner's performance report

The owner played five levels of Line Siege on a TestFlight test build, relaunched it five times, ran the save benchmark and shared the report. Claude saved it as `reports/perf/iphone17-1.0.0-12.json`:

```json
{
 "appId": "com.example.linesiege",
 "appVersion": "1.0.0",
 "buildNumber": "12",
 "deviceModel": "iPhone17,1",
 "entries": [
  { "kind": "cold-start", "label": "home", "atEpochMs": 1790430000000, "data": { "nativeMs": 520, "jsMs": 300, "totalMs": 820 } },
  { "kind": "cold-start", "label": "home", "atEpochMs": 1790430000001, "data": { "nativeMs": 490, "jsMs": 300, "totalMs": 790 } },
  { "kind": "cold-start", "label": "home", "atEpochMs": 1790430000002, "data": { "nativeMs": 545, "jsMs": 300, "totalMs": 845 } },
  { "kind": "cold-start", "label": "home", "atEpochMs": 1790430000003, "data": { "nativeMs": 501, "jsMs": 300, "totalMs": 801 } },
  { "kind": "cold-start", "label": "home", "atEpochMs": 1790430000004, "data": { "nativeMs": 530, "jsMs": 300, "totalMs": 830 } },
  { "kind": "frames", "label": "line-siege/level-1", "atEpochMs": 1790430100000, "data": { "frames": 1440, "seconds": 12.1, "refreshHz": 120, "p50UpToMs": 9, "p95UpToMs": 17, "maxMs": 41, "hitchMsPerS": 3.2, "buckets": [1300, 110, 20, 7, 3, 0, 0] } },
  { "kind": "frames", "label": "line-siege/level-2", "atEpochMs": 1790430100000, "data": { "frames": 1440, "seconds": 12.1, "refreshHz": 120, "p50UpToMs": 9, "p95UpToMs": 17, "maxMs": 41, "hitchMsPerS": 6.4, "buckets": [1300, 110, 20, 7, 3, 0, 0] } },
  { "kind": "save-benchmark", "label": "save-write", "atEpochMs": 1790430200000, "data": { "p50": 0.4, "p95": 0.9, "max": 2.1 } }
 ]
}
```

## Run the check

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check-perf-report.mjs reports/perf/iphone17-1.0.0-12.json --root .
```

```
report: com.example.linesiege 1.0.0 (12) on iPhone17,1
cold start: median 820 ms of 5 launches (limit 1000 ms)
frames line-siege/level-1: 1440 frames at 120 Hz, p95 <= 17 ms, hitch 3.2 ms/s
frames line-siege/level-2: 1440 frames at 120 Hz, p95 <= 17 ms, hitch 6.4 ms/s
save write: p95 0.9 ms
check-perf-report: 8 report entries checked, 0 problems
RESULT: PASS
```

## How to read it

- **Cold start** is the median `totalMs` of the launches (process start to Home interactive). `nativeMs` (process start to the JS entry) is most of it; if the total grows, compare both parts across builds: a growing `jsMs` means module-scope or Splash work, a growing `nativeMs` means native start-up (pods, bundle size).
- **Frames** at 120 Hz: the buckets are frame counts up to 9 / 17 / 25 / 34 / 50 / 100 ms and slower; `p95UpToMs` 17 means 95 % of frames finished within the 17 ms bucket (1,300 + 110 of 1,440); the hitch rate is milliseconds of lateness per second (good ≤ 10). Level 2 is twice as hitchy as level 1 but within budget; if it trends up, look at the busiest animation of that level first.
- **Save write** p95 0.9 ms on the device, far under 5 ms.

## When it fails

Each `FAIL` line names the entry and the fix, for example `[hitch-rate] line-siege/level-3: hitch rate 14.2 ms/s is over 10 ms/s`. A `p95UpToMs` of `null` means the p95 fell in the slowest bucket (over 100 ms: the app's `Infinity` is written as `null` in JSON), and the check fails it. Reproduce the level, find the per-frame work (React state per frame, Skia allocation in the worklet, many unbatched sprites, a callback that never stops), fix it, and ask the owner for a new report. Never loosen the budget to pass; that needs the owner's approval and a `Gate-Change:` trailer.
