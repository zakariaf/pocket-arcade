// assemble-fixtures.mjs: builds the self-test repos in a temporary folder. The good repo is this
// skill's own templates, installed the way the workflow installs them (game-kit files copied,
// the app templates instantiated for a real game id), so the self-test also proves the templates
// pass the checker. Each bad-* repo is that good repo with the one planted bug its mutation.json
// describes. Not an entry point.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { makeTempDir, toPosix } from '../check-lib.mjs';

/** Placeholder forms of a kebab-case game id, as the templates use them. */
export function placeholders(gameId) {
  const pascal = gameId.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join('');
  return [
    ['__GAME_ID__', gameId],
    ['__GAME_PASCAL__', pascal],
    ['__GAME_CONST__', gameId.toUpperCase().replaceAll('-', '_')],
    ['__GAME_CAMEL__', pascal[0].toLowerCase() + pascal.slice(1)],
  ];
}

function fill(text, pairs) {
  return pairs.reduce((out, [key, value]) => out.replaceAll(key, value), text);
}

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    return statSync(abs).isDirectory() ? filesUnder(abs) : [abs];
  });
}

/** Copies a template tree into `to`, filling placeholders in paths and text. */
export function instantiate(from, to, gameId) {
  const pairs = placeholders(gameId);
  for (const abs of filesUnder(from)) {
    const target = join(to, fill(toPosix(relative(from, abs)), pairs));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, fill(readFileSync(abs, 'utf8'), pairs));
  }
}

function replaceOp(dir, op, label) {
  const path = join(dir, op.file);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(op.find)) throw new Error(`${label}: "${op.find}" not found in ${op.file} (the fixture is stale)`);
  writeFileSync(path, op.all ? text.replaceAll(op.find, op.with) : text.replace(op.find, op.with));
}

/** Applies one fixture's mutation.json; every op must apply, so a stale fixture fails loudly. */
export function applyMutation(dir, ops, label) {
  for (const op of ops) {
    if (op.replace) replaceOp(dir, op.replace, label);
    else if (op.write) {
      mkdirSync(dirname(join(dir, op.write.file)), { recursive: true });
      writeFileSync(join(dir, op.write.file), op.write.content);
    } else if (op.delete) {
      if (!existsSync(join(dir, op.delete))) throw new Error(`${label}: ${op.delete} does not exist (the fixture is stale)`);
      rmSync(join(dir, op.delete), { recursive: true });
    } else throw new Error(`${label}: unknown mutation op ${JSON.stringify(op)}`);
  }
}

/**
 * Returns a temporary fixtures folder: good/ plus one bad-<case>/ per folder in `mutations`
 * (each with its EXPECT.txt). `build(dir)` writes the good repo.
 */
export function assembleFixtures(mutations, build) {
  const out = makeTempDir('game-app-fixtures-');
  const good = join(out, 'good');
  mkdirSync(good);
  build(good);
  for (const name of readdirSync(mutations).filter((entry) => entry.startsWith('bad-')).sort()) {
    const target = join(out, name);
    cpSync(good, target, { recursive: true });
    const ops = JSON.parse(readFileSync(join(mutations, name, 'mutation.json'), 'utf8'));
    applyMutation(target, ops, name);
    cpSync(join(mutations, name, 'EXPECT.txt'), join(target, 'EXPECT.txt'));
  }
  return out;
}
