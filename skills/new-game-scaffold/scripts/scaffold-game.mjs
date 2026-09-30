#!/usr/bin/env node
// scaffold-game.mjs: generates apps/<game-id>/ (package.json in dependency lockstep with the other
// apps, tsconfig, metro config with the variant cache key, app.config.ts, game.config.ts with the
// game's modes, hints, continue and age rating, the placeholder entry, .gitignore, the four catalogs
// and the Toybox fonts) from this skill's templates. Dry run by default; --write writes a new app;
// --add-missing writes only the files that are absent (an app that exists, such as the bootstrap's
// pilot). It never overwrites a file.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/scaffold-game.mjs --app <game-id> --name "<Name>" --hints none --continue once [--write]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, run } from './check-lib.mjs';
import { buildAppPlan, DECK_LOSE_SLUGS, DEFAULT_LOSE_SLUG, deckGame, existingApps, GAME_ID, LOSE_SLUG, PILOT, RESERVED_IDS, settingsProblems, suggestedSalt, VIOLENCE_RATINGS } from './lib/app-plan.mjs';

const SPEC = {
  name: 'scaffold-game',
  summary: 'Plans (default), writes (--write) or completes (--add-missing) a game app apps/<game-id>/ from this skill\'s templates. Dependencies are copied from the existing apps so every app stays in lockstep; the catalogs come from the copy deck (lose reason as <id>.lose.<slug>), the canonical Line Siege set for the pilot, or the template keys for any other game. --write refuses when a file exists with other content; --add-missing writes only the absent files and keeps every existing one.',
  usage: '--app <game-id> [--name "<Name>"] [--hints none|solver] [--continue once|none] [options]',
  options: {
    app: { type: 'string', help: 'Game id, kebab-case (e.g. flock-tilt); becomes apps/<id>, @e07/<id> and GameConfig.id', value: 'id' },
    name: { type: 'string', help: 'Display name in Latin script (en and de; fa and ckb too unless given); default: the copy deck\'s name', value: 'text' },
    'bundle-id': { type: 'string', help: 'Owner-approved bundle id (step G1); default com.example.<id> placeholder', value: 'id' },
    'name-fa': { type: 'string', help: 'Persian display name (default: the Latin name)', value: 'text' },
    'name-ckb': { type: 'string', help: 'Sorani display name (default: the Latin name)', value: 'text' },
    hints: { type: 'string', value: 'kind', help: 'none (no hint: hints.freePerDay 0) or solver (a solver\'s next move: 1 free per day); required unless the game\'s rules are known (the pilot line-siege: none)' },
    continue: { type: 'string', value: 'kind', help: 'once (rules.continueRun once: isContinueAllowed true) or none (false); required unless known (line-siege: once)' },
    'lose-reason': { type: 'string', value: 'slug', help: `The main lose key <id>.lose.<slug> (default: the copy deck's slug, else ${DEFAULT_LOSE_SLUG})` },
    'violence-rating': { type: 'string', value: 'level', help: `App Store "cartoon or fantasy violence" answer, ${VIOLENCE_RATINGS.join(' | ')} (default NONE; line-siege INFREQUENT_OR_MILD); the owner confirms it at step G1` },
    endless: { type: 'boolean', help: 'Switch the endless mode on (default off unless the copy deck lists it); must match the levels spec' },
    'no-daily': { type: 'boolean', help: 'Switch the daily mode off (default on)' },
    root: { type: 'string', default: '.', help: 'App repo root', value: 'dir' },
    write: { type: 'boolean', help: 'Write a new app (refuses when any file exists with other content)' },
    'add-missing': { type: 'boolean', help: 'Write only the absent files of an existing app, keep every existing file, list the ones kept' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Plan lines: "new <file>", "same <file>" (already identical), "keep <file>" (--add-missing: exists with',
    'other content, left alone), "FAIL ... [conflict]" (--write or the plan: exists with other content).',
    'Rules: conflict (a file differs; --write writes nothing), deps-lockstep (existing apps disagree on',
    'dependencies, so the new package.json has no single set to copy).',
    '',
    'Examples:',
    '  node scaffold-game.mjs --app flock-tilt --hints none --continue once --write',
    '  node scaffold-game.mjs --app line-siege --add-missing        (complete the bootstrap\'s pilot)',
  ].join('\n'),
};

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(here, '..');

function readDeck() {
  const path = join(skillDir, 'assets', 'copy-deck.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function validateTarget(options, root) {
  const gameId = options.app ?? '';
  if (!GAME_ID.test(gameId) || RESERVED_IDS.has(gameId)) fail(`--app "${gameId}" is not a kebab-case game id`, 'Pass the game id from the catalogue, e.g. --app flock-tilt.');
  const rootManifest = join(root, 'package.json');
  const workspaces = existsSync(rootManifest) ? (JSON.parse(readFileSync(rootManifest, 'utf8')).workspaces ?? []) : [];
  if (!workspaces.includes('apps/*')) fail(`${root} is not the monorepo root (no package.json with workspaces "apps/*")`, 'Run from the repo root, or bootstrap the monorepo first (monorepo-bootstrap).');
  if (options.write && options['add-missing']) fail('pass --write or --add-missing, not both', '--write creates a new app; --add-missing completes an existing one.');
  return gameId;
}

function namesFor(options, deckName) {
  const latin = options.name ?? deckName?.en;
  if (!latin) fail('--name is required for a game that is not in the copy deck', 'Pass --name "Bank Shot".');
  return { en: latin, de: options.name ?? deckName?.de ?? latin, fa: options['name-fa'] ?? deckName?.fa ?? latin, ckb: options['name-ckb'] ?? deckName?.ckb ?? latin };
}

/** hints and continue come from the game's rules: known for the pilot, otherwise the caller says. */
function rulesChoice(options, key, isPilot, needed) {
  if (options[key] !== undefined) return options[key];
  if (isPilot) return key === 'hints' ? PILOT.hints : PILOT.continueRun;
  if (!needed) return 'none';
  return fail(`--${key} is required: the game's rules decide it`, key === 'hints' ? 'Pass --hints none (no hint; hints.freePerDay 0) or --hints solver (a solver proves the next move; 1 free hint per day).' : 'Pass --continue once (rules.continueRun { kind: \'once\' }; isContinueAllowed true) or --continue none (false).');
}

function settingsFor(options, root, gameId, deck) {
  const isPilot = gameId === PILOT.id;
  const game = deckGame(deck, gameId);
  const needed = !existsSync(join(root, 'apps', gameId, 'game.config.ts'));
  const deckModes = game?.modes ?? null;
  const settings = {
    gameId,
    bundleId: options['bundle-id'] ?? `com.example.${gameId.replaceAll('-', '')}`,
    names: namesFor(options, game?.name),
    modes: {
      daily: !options['no-daily'] && (deckModes === null || deckModes.includes('daily')),
      endless: Boolean(options.endless) || (deckModes !== null && deckModes.includes('endless')),
    },
    hints: rulesChoice(options, 'hints', isPilot, needed),
    continueRun: rulesChoice(options, 'continue', isPilot, needed),
    violence: options['violence-rating'] ?? (isPilot ? PILOT.violence : 'NONE'),
  };
  const problems = settingsProblems(settings);
  if (problems.length > 0) fail(problems.join('; '), 'Fix the option values and rerun.');
  const loseSlug = options['lose-reason'] ?? DECK_LOSE_SLUGS[gameId] ?? DEFAULT_LOSE_SLUG;
  if (!LOSE_SLUG.test(loseSlug)) fail(`--lose-reason "${loseSlug}" is not kebab-case words`, 'Name what happened, e.g. --lose-reason out-of-moves.');
  return { settings, loseSlug };
}

function lockstepDependencies(root, gameId, report, isNeeded) {
  const apps = existingApps(root, gameId);
  if (apps.length === 0) return null;
  const [first, ...rest] = apps;
  for (const other of rest) {
    if (isNeeded && JSON.stringify(other.dependencies) !== JSON.stringify(first.dependencies)) report.problem({ file: `apps/${other.id}/package.json`, rule: 'deps-lockstep', message: `dependencies differ from apps/${first.id}/package.json; a new app cannot copy a single set`, fix: 'Bring every app to the same dependency set first (dependency-management), then scaffold.' });
  }
  return first.dependencies;
}

function sameContent(path, content) {
  if (!existsSync(path)) return null;
  const current = readFileSync(path);
  return Buffer.isBuffer(content) ? current.equals(content) : current.toString('utf8') === content;
}

/** Classify every plan file: new, same, keep (--add-missing) or conflict. */
function classify(plan, root, addMissing, report, gameId) {
  const fresh = [];
  for (const file of plan) {
    const same = sameContent(join(root, file.rel), file.content);
    if (same === null) {
      fresh.push(file);
      report.note(`new  ${file.rel}`);
    } else if (same) report.note(`same ${file.rel}`);
    else if (addMissing) report.note(`keep ${file.rel} (exists with other content; --add-missing never overwrites)`);
    else report.problem({ file: file.rel, rule: 'conflict', message: 'exists with different content', fix: `Compare it with the template; for an app that already exists (the bootstrap's pilot) run scaffold-game.mjs --app ${gameId} --add-missing, which writes only the absent files.` });
  }
  return fresh;
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const root = resolve(options.root);
  const gameId = validateTarget(options, root);
  const report = createReporter({ name: 'scaffold-game' });
  const deck = readDeck();
  const { settings, loseSlug } = settingsFor(options, root, gameId, deck);
  const needsManifest = !existsSync(join(root, 'apps', gameId, 'package.json'));
  const dependencies = lockstepDependencies(root, gameId, report, needsManifest);
  const plan = buildAppPlan({ skillDir, settings, loseSlug, dependencies, deck });
  const addMissing = Boolean(options['add-missing']);
  const fresh = classify(plan, root, addMissing, report, gameId);
  const writes = addMissing || (options.write && report.count === 0);
  if (writes && report.count === 0) {
    for (const file of fresh) {
      mkdirSync(dirname(join(root, file.rel)), { recursive: true });
      writeFileSync(join(root, file.rel), file.content);
    }
  }
  const done = writes && report.count === 0;
  report.note(`${done ? 'wrote' : 'would write'} ${fresh.length} new files for ${gameId} (daily ${settings.modes.daily ? 'on' : 'off'}, endless ${settings.modes.endless ? 'on' : 'off'}, hints ${settings.hints}, continue ${settings.continueRun}, lose key ${gameId}.lose.${loseSlug}, violence ${settings.violence}, bundle id ${settings.bundleId}${settings.bundleId.startsWith('com.example.') ? ' - a placeholder until the owner approves one, step G1' : ''})`);
  report.note(`suggested daily salt for ${gameId}: 0x${suggestedSalt(gameId).toString(16).padStart(4, '0')} (fix it forever in src/levels/${gameId}-levels.ts)`);
  if (done) report.note(`next: npm install (links the workspace), then node <this skill>/scripts/check-game-app.mjs . --app ${gameId} --stage scaffold`);
  return report.finish({ checked: plan.length, unit: 'planned files' });
});
