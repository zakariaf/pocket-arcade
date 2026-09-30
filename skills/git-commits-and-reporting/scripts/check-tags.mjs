#!/usr/bin/env node
// check-tags.mjs: checks release tags: <game-id>/vX.Y.Z+<build> for every upload and
// <game-id>/vX.Y.Z when the owner says "ship"; the game id is an app folder, a shipped version has
// an uploaded build, and build numbers never repeat or go backwards within one game.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-tags.mjs            (reads the repo's tags with their dates)
//      node ${CLAUDE_SKILL_DIR}/scripts/check-tags.mjs --list tags.txt

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, parseArgs, requireDir, requireFile, run } from './check-lib.mjs';

const SPEC = {
  name: 'check-tags',
  summary: 'Checks the per-app release tags for format, known game ids, a build tag behind every release tag, and build numbers that only go up.',
  usage: '[repo-root] [options]',
  options: {
    list: { type: 'string', value: 'file', help: 'Tags to check, one per line, optionally "<tag> <unix seconds created>" (default: the tags of the repo with their dates)' },
    root: { type: 'string', value: 'dir', help: 'Same as the positional repo root (apps/ gives the game ids)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  tag-format              a tag is not <game-id>/vX.Y.Z or <game-id>/vX.Y.Z+<build>',
    '  tag-unknown-game        the game id has no apps/<game-id> folder',
    '  release-without-build   <game-id>/vX.Y.Z exists without any <game-id>/vX.Y.Z+<build> (nothing was uploaded)',
    '  build-number-reused     one game uses the same build number for two tags',
    '  build-number-order      a higher version has a lower build number than an earlier version, or (when tag',
    '                          dates are known) a build tagged later has a lower number, also within one version',
  ].join('\n'),
};

const TAG = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/v(\d+)\.(\d+)\.(\d+)(?:\+(\d+))?$/;

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  if (positionals[0] !== undefined && options.root !== undefined && positionals[0] !== options.root) fail(`two repo roots given: ${positionals[0]} and --root ${options.root}`, 'Pass the repo root once, as the positional argument.');
  const root = requireDir(positionals[0] ?? options.root ?? '.', 'repo root');
  let text;
  if (options.list) text = readFileSync(requireFile(options.list, 'tag list'), 'utf8');
  else {
    const result = spawnSync('git', ['-C', root, 'for-each-ref', 'refs/tags', '--format=%(refname:strip=2) %(creatordate:unix)'], { encoding: 'utf8' });
    if (result.status !== 0) fail(`git for-each-ref refs/tags failed: ${(result.stderr || '').trim()}`, 'Run inside the git repository or pass --list <file>.');
    text = result.stdout;
  }
  // "<tag>" or "<tag> <unix seconds>": the date orders builds within one version (tags carry no time).
  const rows = text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [tag, created] = line.split(/\s+/);
    return { tag, createdAt: created === undefined ? null : Number(created) };
  });
  const tags = rows.map((row) => row.tag);
  const createdAt = new Map(rows.map((row) => [row.tag, row.createdAt]));
  if (tags.length === 0) fail('there are no tags to check', 'Tags appear after the first upload; pass --list <file> to check planned names.');
  const appsDir = join(root, 'apps');
  const games = existsSync(appsDir) ? new Set(readdirSync(appsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) : null;
  const report = createReporter({ name: 'check-tags', json: options.json });
  const add = (tag, rule, message, fix) => report.problem({ file: tag, line: 0, rule, message, fix });
  const byGame = new Map();
  for (const tag of tags) {
    const match = TAG.exec(tag);
    if (!match) {
      add(tag, 'tag-format', 'is not <game-id>/vX.Y.Z or <game-id>/vX.Y.Z+<build>', 'Tags come only from npm run release:ios; never create or rename them by hand.');
      continue;
    }
    const [, game, major, minor, patch, build] = match;
    if (games && !games.has(game)) add(tag, 'tag-unknown-game', `names "${game}", which has no apps/ folder`, 'Use the game id of an app folder (the kebab-case catalogue id).');
    const entry = byGame.get(game) ?? { releases: [], builds: [] };
    const version = [Number(major), Number(minor), Number(patch)];
    if (build === undefined) entry.releases.push({ tag, version });
    else entry.builds.push({ tag, version, build: Number(build) });
    byGame.set(game, entry);
  }
  const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  for (const [game, { releases, builds }] of byGame) {
    for (const release of releases) {
      if (!builds.some((build) => compare(build.version, release.version) === 0)) add(release.tag, 'release-without-build', 'has no uploaded build tag for the same version', `A version is shipped only after an upload; expect ${game}/v${release.version.join('.')}+<build> first.`);
    }
    const seen = new Map();
    for (const build of builds) {
      if (seen.has(build.build)) add(build.tag, 'build-number-reused', `reuses build ${build.build} (also ${seen.get(build.build)})`, 'Never reuse a build number; the next upload takes the next number.');
      seen.set(build.build, build.tag);
    }
    const sorted = [...builds].sort((a, b) => compare(a.version, b.version) || a.build - b.build);
    for (let i = 1; i < sorted.length; i += 1) {
      if (compare(sorted[i].version, sorted[i - 1].version) > 0 && sorted[i].build < sorted[i - 1].build) add(sorted[i].tag, 'build-number-order', `build ${sorted[i].build} is lower than ${sorted[i - 1].tag}`, 'Build numbers only go up within a game, across versions.');
    }
    const dated = builds.filter((build) => Number.isFinite(createdAt.get(build.tag)));
    if (dated.length === builds.length) {
      const byTime = [...dated].sort((a, b) => createdAt.get(a.tag) - createdAt.get(b.tag) || a.build - b.build);
      for (let i = 1; i < byTime.length; i += 1) {
        if (byTime[i].build < byTime[i - 1].build) add(byTime[i].tag, 'build-number-order', `was tagged after ${byTime[i - 1].tag} but has a lower build number`, 'Build numbers only go up in upload order, also within one version; the next upload takes the next number.');
      }
    }
  }
  return report.finish({ checked: tags.length, unit: 'tags' });
});
