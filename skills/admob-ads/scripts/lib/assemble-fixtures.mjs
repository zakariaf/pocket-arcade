// assemble-fixtures.mjs: builds the self-test cases in a temporary folder. Every case starts as a
// copy of this skill's templates/ (the files Claude copies into the app repo) plus
// tests/fixtures/base-repo/ (the rest of a small app repo), then gets the planted change of its
// mutation.json. So the self-test also proves that the templates pass the checkers.
// Not an entry point.

import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { makeTempDir } from '../check-lib.mjs';

function writeFile(root, rel, content) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

function setPath(object, path, value) {
  let node = object;
  for (const key of path.slice(0, -1)) node = node[key] ??= {};
  if (value === null) delete node[path.at(-1)];
  else node[path.at(-1)] = value;
}

/** Apply one case's planted change. Every op must apply, so a stale fixture fails loudly. */
function applyMutation(dir, ops, label) {
  for (const op of ops) {
    if (op.replace) {
      const { file, find, with: replacement } = op.replace;
      if (!existsSync(join(dir, file))) throw new Error(`${label}: ${file} does not exist; update its mutation.json`);
      const text = readFileSync(join(dir, file), 'utf8');
      if (!text.includes(find)) throw new Error(`${label}: "${find}" not found in ${file}; update its mutation.json`);
      writeFile(dir, file, text.split(find).join(replacement));
    } else if (op.json) {
      const data = JSON.parse(readFileSync(join(dir, op.json.file), 'utf8'));
      setPath(data, op.json.path, op.json.value);
      writeFile(dir, op.json.file, `${JSON.stringify(data, null, 2)}\n`);
    } else if (op.write) {
      writeFile(dir, op.write.file, op.write.content);
    } else if (op.delete) {
      if (!existsSync(join(dir, op.delete))) throw new Error(`${label}: ${op.delete} does not exist; update its mutation.json`);
      rmSync(join(dir, op.delete), { recursive: true });
    } else {
      throw new Error(`${label}: unknown op ${JSON.stringify(op)}`);
    }
  }
}

/**
 * tests/fixtures/<suite>/<case> -> <tmp>/<case>: templates + base repo + mutation + the case's own
 * files (EXPECT.txt, ARGS.txt). Returns the temporary suite folder; the caller removes it.
 */
export function assembleSuite({ templates, baseRepo, suiteDir, prefix = 'skill-fixtures-' }) {
  const tmp = makeTempDir(prefix);
  for (const name of readdirSync(suiteDir).filter((entry) => entry === 'good' || entry.startsWith('bad-'))) {
    const source = join(suiteDir, name);
    const target = join(tmp, name);
    if (templates) cpSync(templates, target, { recursive: true });
    if (baseRepo) cpSync(baseRepo, target, { recursive: true });
    mkdirSync(target, { recursive: true });
    const mutation = join(source, 'mutation.json');
    if (existsSync(mutation)) applyMutation(target, JSON.parse(readFileSync(mutation, 'utf8')), name);
    for (const file of readdirSync(source).filter((entry) => entry !== 'mutation.json')) copyFileSync(join(source, file), join(target, file));
  }
  return tmp;
}
