#!/usr/bin/env node
// link-skills.mjs: makes Claude Code see every skill in skills/ by creating the relative symlinks
// .claude/skills/<name> -> ../../skills/<name>, and removes links whose skill is gone.

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_SKILLS_ROOT, listSkillDirs } from './lib/library.mjs';
import { UsageError, createReporter, parseArgs, run, sha256, walk } from './shared/scripts/check-lib.mjs';

const COPY_MARKER = '.link-skills-copy';
const LINK_PREFIX = '../../skills/';

const SPEC = {
  name: 'link-skills',
  summary: 'Creates .claude/skills/<name> -> ../../skills/<name> for every skill folder in skills/ (relative symlinks, so the repo can move) and removes links this script made whose skill no longer exists. Real folders and links pointing elsewhere are never touched.',
  usage: '[options]',
  options: {
    root: { type: 'string', value: 'dir', help: 'Repo root that holds skills/ and .claude/ (default: the parent of skills/)' },
    check: { type: 'boolean', help: 'Change nothing; exit 1 when a link is missing, wrong or stale' },
    copy: { type: 'boolean', help: `Copy each skill folder instead of linking it (fallback for tools that do not follow symlinks); copies carry a ${COPY_MARKER} marker` },
  },
  positionals: { min: 0, max: 0 },
  details: 'Claude Code 2.1.283 was tested to load symlinked project skills (listing, /name and the Skill tool), so links are the default.\nWrites under .claude/ are protected paths: in an interactive session Claude Code may ask the owner to approve them.',
};

function entryKind(path) {
  if (!existsSync(path) && !isLink(path)) return 'missing';
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return 'link';
  if (stat.isDirectory()) return existsSync(join(path, COPY_MARKER)) ? 'copy' : 'dir';
  return 'file';
}

function isLink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function treeHash(dir) {
  const files = walk(dir, { defaultIgnores: false, ignore: ['node_modules', '.git', '.DS_Store', COPY_MARKER] });
  return sha256(files.map((rel) => `${rel}\0${sha256(readFileSync(join(dir, rel)))}`).join('\n'));
}

function makeCopy(source, dest, name) {
  rmSync(dest, { recursive: true, force: true });
  cpSync(source, dest, { recursive: true, filter: (src) => !src.split('/').includes('node_modules') && !src.endsWith('/.DS_Store') });
  writeFileSync(join(dest, COPY_MARKER), `Copied from skills/${name} by link-skills.mjs --copy. Edit the skill in skills/${name} and rerun link-skills.mjs --copy.\n`);
}

async function main() {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const root = resolve(options.root ?? dirname(DEFAULT_SKILLS_ROOT));
  const skillsDir = join(root, 'skills');
  if (!existsSync(skillsDir)) throw new UsageError(`no skills/ folder in ${root}`, 'Pass --root <repo root>.');
  const linkDir = join(root, '.claude', 'skills');
  const skills = listSkillDirs(skillsDir).filter((skill) => existsSync(join(skill.dir, 'SKILL.md')));
  for (const skill of listSkillDirs(skillsDir).filter((item) => !existsSync(join(item.dir, 'SKILL.md')))) console.log(`skip  ${skill.name} (no SKILL.md)`);
  const report = createReporter({ name: 'link-skills' });
  const mode = options.copy ? 'copy' : 'link';
  const write = !options.check;
  if (write && !existsSync(linkDir)) mkdirSync(linkDir, { recursive: true });
  const wanted = new Map(skills.map((skill) => [skill.name, skill]));

  for (const skill of skills) {
    const dest = join(linkDir, skill.name);
    const target = `${LINK_PREFIX}${skill.name}`;
    const kind = entryKind(dest);
    const shown = `.claude/skills/${skill.name}`;
    if (kind === 'dir' || kind === 'file') {
      report.problem({ file: shown, rule: 'link-conflict', message: `a real ${kind === 'dir' ? 'folder' : 'file'} is in the way; it was not made by this script`, fix: `Move its content into skills/${skill.name} (or delete it), then rerun.` });
      continue;
    }
    if (mode === 'link') {
      if (kind === 'link' && readlinkSync(dest) === target) {
        console.log(`ok    ${shown} -> ${target}`);
        continue;
      }
      const what = kind === 'missing' ? 'missing' : kind === 'copy' ? 'is a copy, not a link' : `points to ${readlinkSync(dest)}`;
      if (!write) {
        report.problem({ file: shown, rule: 'link-missing', message: `link ${what}`, fix: 'Run: node skills/_library/link-skills.mjs' });
        continue;
      }
      rmSync(dest, { recursive: true, force: true });
      symlinkSync(target, dest, 'dir');
      console.log(`link  ${shown} -> ${target}${kind === 'missing' ? '' : ` (was: ${what})`}`);
      continue;
    }
    // copy mode
    const fresh = kind === 'copy' && treeHash(dest) === treeHash(skill.dir);
    if (fresh) {
      console.log(`ok    ${shown} (copy)`);
      continue;
    }
    if (!write) {
      report.problem({ file: shown, rule: 'link-missing', message: kind === 'copy' ? 'copy is out of date' : kind === 'link' ? 'is a link, not a copy' : 'copy missing', fix: 'Run: node skills/_library/link-skills.mjs --copy' });
      continue;
    }
    makeCopy(skill.dir, dest, skill.name);
    console.log(`copy  ${shown} <- skills/${skill.name}`);
  }

  if (existsSync(linkDir)) {
    for (const name of readdirSync(linkDir).sort()) {
      if (wanted.has(name)) continue;
      const dest = join(linkDir, name);
      const kind = entryKind(dest);
      const ours = (kind === 'link' && readlinkSync(dest).startsWith(LINK_PREFIX)) || kind === 'copy';
      if (!ours) {
        if (kind !== 'missing' && !name.startsWith('.')) console.log(`keep  .claude/skills/${name} (not made by this script)`);
        continue;
      }
      if (!write) {
        report.problem({ file: `.claude/skills/${name}`, rule: 'link-stale', message: `stale ${kind}: skills/${name} is not a skill folder any more`, fix: 'Run: node skills/_library/link-skills.mjs' });
        continue;
      }
      rmSync(dest, { recursive: true, force: true });
      console.log(`gone  .claude/skills/${name} (removed stale ${kind})`);
    }
  }
  return report.finish({ checked: skills.length, unit: 'skills' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run(main);
