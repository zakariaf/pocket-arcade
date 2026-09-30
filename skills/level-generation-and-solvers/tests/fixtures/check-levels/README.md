# check-levels self-test fixtures

`base/` holds the files the good repo needs besides this skill's own templates: the template
game's rules modules with its tuning file, the RNG and `contract/difficulty.ts` (the level plan and solver import them)
and a minimal `game.config.ts`; the self-test adds a root `package.json` that pins fast-check. The self-test builds good/ from `templates/` (instantiated as
`tap-flip`), `examples/tap-flip-levels.golden.test.ts.snap.ios` and `base/`, then generates the
packs from the plan exactly as `generate-levels.ts` writes them (the templates ship no packs).
Each `bad-*/mutation.json` plants one bug and `EXPECT.txt` lists what the checker must print.

Mutation ops: `replace` (`file`, `find`, `with`, optional `all`), `write` (`file`, `content`),
`delete` (a path), `reformat` (`file`: rewrite a JSON file in plain `JSON.stringify` layout).
