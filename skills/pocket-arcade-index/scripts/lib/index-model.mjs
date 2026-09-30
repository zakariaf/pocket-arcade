// index-model.mjs: reads the skills and the curated index data, and renders the generated parts of
// the router (the skill table, the task matrix, the build orders and the quick table in SKILL.md).
// Shared by build-index.mjs (writes) and check-index.mjs (compares). Not an entry point.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** This skill's folder (scripts/lib/ is two levels below it). */
export const SKILL_DIR = resolve(HERE, '..', '..');
/** The folder that holds this skill and its siblings: skills/ or .claude/skills/. */
export const DEFAULT_SKILLS_ROOT = resolve(SKILL_DIR, '..');

export const DATA_FILE = 'assets/index.json';
export const QUICK_START = '<!-- generated:task-table:start (build-index.mjs; edit assets/index.json instead) -->';
export const QUICK_END = '<!-- generated:task-table:end -->';
export const GENERATED_FILES = ['references/skill-table.md', 'references/task-matrix.md', 'references/build-orders.md'];
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** name and description from a SKILL.md frontmatter (one-line values, optionally quoted). */
export function readFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end === -1) return null;
  const values = {};
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1).replaceAll("''", "'");
    }
    values[match[1]] = value;
  }
  return values;
}

/** Every skill in the root: a folder (or a link to one) holding a SKILL.md, sorted by name. */
export function readSkills(root) {
  const skills = [];
  for (const entry of readdirSync(root).sort()) {
    if (entry.startsWith('.') || entry.startsWith('_')) continue;
    const dir = join(root, entry);
    let isDir = false;
    try {
      isDir = statSync(dir).isDirectory();
    } catch {
      continue;
    }
    if (!isDir || !existsSync(join(dir, 'SKILL.md'))) continue;
    const frontmatter = readFrontmatter(readFileSync(join(dir, 'SKILL.md'), 'utf8')) ?? {};
    skills.push({ folder: entry, name: frontmatter.name ?? '', description: frontmatter.description ?? '' });
  }
  return skills;
}

/** The curated data, or an error message saying what is wrong with its shape. */
export function readIndexData(indexDir) {
  const path = join(indexDir, DATA_FILE);
  if (!existsSync(path)) return { error: `${DATA_FILE} does not exist` };
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { error: `${DATA_FILE} is not valid JSON (${error.message})` };
  }
  const isList = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
  const categoriesOk = Array.isArray(data.categories) && data.categories.every((c) => typeof c?.name === 'string' && typeof c?.why === 'string' && isList(c?.skills));
  const tasksOk = Array.isArray(data.tasks) && data.tasks.every((t) => typeof t?.task === 'string' && isList(t?.skills) && (t.note === undefined || typeof t.note === 'string'));
  const stepsOk = (steps) => Array.isArray(steps) && steps.every((s) => typeof s?.step === 'string' && isList(s?.skills) && typeof s?.proof === 'string');
  if (!categoriesOk) return { error: `${DATA_FILE}: categories must be a list of { name, why, skills: [names] }` };
  if (!tasksOk) return { error: `${DATA_FILE}: tasks must be a list of { task, skills: [names], note? }` };
  if (!stepsOk(data.buildOrders?.shell) || !stepsOk(data.buildOrders?.game)) return { error: `${DATA_FILE}: buildOrders.shell and buildOrders.game must be lists of { step, skills: [names], proof }` };
  const sectionError = buildOrderSectionsError(data.buildOrders) ?? extraSectionsError(data.buildOrders, isList, stepsOk);
  if (sectionError) return { error: `${DATA_FILE}: ${sectionError}` };
  return { data };
}

/** The optional prose sections of buildOrders: commands, slice (strings) and verifyGreen ({ intro, rows }). */
function buildOrderSectionsError(buildOrders) {
  for (const key of ['commands', 'slice']) {
    if (buildOrders[key] !== undefined && (typeof buildOrders[key] !== 'string' || buildOrders[key].trim() === '')) return `buildOrders.${key} must be a non-empty string when present`;
  }
  const green = buildOrders.verifyGreen;
  if (green === undefined) return null;
  const rowOk = (row) => ['gate', 'greenFrom', 'before'].every((key) => typeof row?.[key] === 'string' && row[key].trim() !== '');
  if (typeof green?.intro !== 'string' || !Array.isArray(green?.rows) || green.rows.length === 0 || !green.rows.every(rowOk)) {
    return 'buildOrders.verifyGreen must be { intro, rows: [{ gate, greenFrom, before }] } with at least one row';
  }
  return null;
}

/**
 * The optional structured sections of buildOrders:
 *   sliceCore:   { intro, rows: [{ files, part, skill }] }  the files every Shell app needs whatever the slice
 *   extraOrders: [{ title, intro, steps: [{ step, skills, proof }] }]  short orders for one situation
 */
function extraSectionsError(buildOrders, isList, stepsOk) {
  const core = buildOrders.sliceCore;
  const text = (value) => typeof value === 'string' && value.trim() !== '';
  if (core !== undefined) {
    const rowOk = (row) => text(row?.files) && text(row?.part) && text(row?.skill);
    if (!text(core?.intro) || !Array.isArray(core?.rows) || core.rows.length === 0 || !core.rows.every(rowOk)) {
      return 'buildOrders.sliceCore must be { intro, rows: [{ files, part, skill }] } with at least one row';
    }
  }
  const extra = buildOrders.extraOrders;
  if (extra !== undefined) {
    const orderOk = (order) => text(order?.title) && text(order?.intro) && stepsOk(order?.steps) && order.steps.length > 0 && order.steps.every((step) => isList(step.skills));
    if (!Array.isArray(extra) || !extra.every(orderOk)) return 'buildOrders.extraOrders must be a list of { title, intro, steps: [{ step, skills: [names], proof }] }';
  }
  return null;
}

/** Every build step with a label, the Shell and game orders first, then each extra order. */
export function buildSteps(data) {
  const steps = [];
  for (const kind of ['shell', 'game']) data.buildOrders[kind].forEach((step, index) => steps.push({ label: `buildOrders.${kind}[${index}]`, step }));
  (data.buildOrders.extraOrders ?? []).forEach((order, orderIndex) => order.steps.forEach((step, index) => steps.push({ label: `buildOrders.extraOrders[${orderIndex}].steps[${index}] ("${order.title}")`, step })));
  return steps;
}

/** Every place the data names a skill, for the stale-name check. */
export function namedSkills(data) {
  const out = [];
  data.categories.forEach((category, index) => category.skills.forEach((name) => out.push({ name, where: `categories[${index}] "${category.name}"` })));
  data.tasks.forEach((task, index) => task.skills.forEach((name) => out.push({ name, where: `tasks[${index}] "${task.task}"` })));
  for (const { label, step } of buildSteps(data)) step.skills.forEach((name) => out.push({ name, where: label }));
  (data.buildOrders.sliceCore?.rows ?? []).forEach((row, index) => out.push({ name: row.skill, where: `buildOrders.sliceCore.rows[${index}]` }));
  return out;
}

const cell = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
const code = (name) => `\`${name}\``;
const GENERATED_NOTE = 'Generated by `scripts/build-index.mjs` from `assets/index.json` and every skill\'s frontmatter. Do not edit it by hand: change the data (or a skill\'s description), then run `node ${CLAUDE_SKILL_DIR}/scripts/build-index.mjs --write`.';

export function renderSkillTable(data, skills) {
  const byName = new Map(skills.map((skill) => [skill.folder, skill]));
  const lines = ['# Skill catalogue', '', GENERATED_NOTE, '', `${skills.length} skills in ${data.categories.length} groups. Each row is the skill's own description: what Claude Code reads when it decides to load a skill.`, '', '## Contents', ''];
  for (const category of data.categories) lines.push(`- ${category.name}`);
  for (const category of data.categories) {
    lines.push('', `## ${category.name}`, '', category.why, '', '| Skill | Description |', '|---|---|');
    for (const name of category.skills) lines.push(`| ${code(name)} | ${cell(byName.get(name)?.description ?? '(no such skill)')} |`);
  }
  return `${lines.join('\n')}\n`;
}

export function renderTaskMatrix(data) {
  const lines = ['# Task to skills', '', GENERATED_NOTE, '', '## Contents', '', '- How to read a row', '- The matrix', '', '## How to read a row', '',
    'Find the row closest to the task and load every skill in it before writing code; the first skill leads the work and the others each own one part of it (their rules and checks apply too). Several rows can apply: load the union. The note says what to add or watch for. A skill the owner names in the task is always loaded as well.',
    '', '## The matrix', '', '| # | Task | Load these skills (the first one leads) | Note |', '|---|---|---|---|'];
  data.tasks.forEach((task, index) => lines.push(`| ${index + 1} | ${cell(task.task)} | ${task.skills.map(code).join(', ')} | ${cell(task.note ?? '')} |`));
  return `${lines.join('\n')}\n`;
}

function stepTable(steps) {
  const lines = ['| # | Step | Skills | Done when |', '|---|---|---|---|'];
  steps.forEach((step, index) => lines.push(`| ${index + 1} | ${cell(step.step)} | ${step.skills.map(code).join(', ')} | ${cell(step.proof)} |`));
  return lines;
}

const COMMANDS_HEADING = 'Running a "done when" check';
const SLICE_HEADING = 'A partial Shell: shell-slice.json';
const CORE_HEADING = 'The partial Shell core';
const GREEN_HEADING = 'When npm run verify is green';

function sliceCoreTable(core) {
  return [core.intro, '', '| Files | Part | Owning skill |', '|---|---|---|',
    ...core.rows.map((row) => `| ${cell(row.files)} | ${cell(row.part)} | ${code(row.skill)} |`)];
}

function extraOrderSections(orders) {
  return orders.flatMap((order) => ['', `## ${order.title}`, '', order.intro, '', ...stepTable(order.steps)]);
}

function verifyGreenTable(green) {
  return [green.intro, '', '| verify step | Green from | Before that |', '|---|---|---|',
    ...green.rows.map((row) => `| ${cell(row.gate)} | ${cell(row.greenFrom)} | ${cell(row.before)} |`)];
}

export function renderBuildOrders(data) {
  const { commands, slice, sliceCore, extraOrders = [], verifyGreen } = data.buildOrders;
  const contents = [...(commands ? [COMMANDS_HEADING] : []), 'The Shell with the pilot game', ...(slice ? [SLICE_HEADING] : []), ...(sliceCore ? [CORE_HEADING] : []), ...extraOrders.map((order) => order.title), ...(verifyGreen ? [GREEN_HEADING] : []), 'Every new game'];
  const lines = ['# Build orders', '', GENERATED_NOTE, '', '## Contents', '', ...contents.map((heading) => `- ${heading}`), '',
    'Each layer is tested before anything depends on it: rules, then level generator, then save format, then services with fakes, then hooks, then screens, then end-to-end flows, then the screenshot matrix. A step starts only when the step before it passes its "done when" check. Every step is test-first (tdd-workflow) and ends in a commit and a short report (git-commits-and-reporting).',
    ...(commands ? ['', `## ${COMMANDS_HEADING}`, '', commands] : []),
    '', '## The Shell with the pilot game', '',
    'The Shell is built once, together with the pilot game (Line Siege unless the owner decided otherwise), because a framework cannot be judged without a real game inside it. Spec section 15 (items 15.1 to 15.8) is the exit test: every item needs its evidence in the release report.', '',
    ...stepTable(data.buildOrders.shell),
    ...(slice ? ['', `## ${SLICE_HEADING}`, '', slice] : []),
    ...(sliceCore ? ['', `## ${CORE_HEADING}`, '', ...sliceCoreTable(sliceCore)] : []),
    ...extraOrderSections(extraOrders),
    ...(verifyGreen ? ['', `## ${GREEN_HEADING}`, '', ...verifyGreenTable(verifyGreen)] : []),
    '', '## Every new game', '',
    'Every later game is a new app in apps/<game-id>/ on the same Shell. The owner picks it and approves its design notes first; the owner\'s per-game steps (G1 to G8) are asked for in one message and run in parallel with the build.', '',
    ...stepTable(data.buildOrders.game)];
  return `${lines.join('\n')}\n`;
}

export function renderQuickTable(data) {
  const lines = [QUICK_START, '| Task | Load these skills (the first one leads) |', '|---|---|'];
  for (const task of data.tasks) lines.push(`| ${cell(task.task)} | ${task.skills.map(code).join(' ')} |`);
  lines.push(QUICK_END);
  return lines.join('\n');
}

/** SKILL.md with its generated block replaced, or null when the markers are missing. */
export function withQuickTable(skillMd, data) {
  const start = skillMd.indexOf(QUICK_START);
  const end = skillMd.indexOf(QUICK_END);
  if (start === -1 || end === -1 || end < start) return null;
  return `${skillMd.slice(0, start)}${renderQuickTable(data)}${skillMd.slice(end + QUICK_END.length)}`;
}

/** Every generated output: relative path -> the content it must have now (SKILL.md null when unmarked). */
export function renderAll(indexDir, data, skills) {
  const skillMdPath = join(indexDir, 'SKILL.md');
  const skillMd = existsSync(skillMdPath) ? readFileSync(skillMdPath, 'utf8') : '';
  return {
    'references/skill-table.md': renderSkillTable(data, skills),
    'references/task-matrix.md': renderTaskMatrix(data),
    'references/build-orders.md': renderBuildOrders(data),
    'SKILL.md': withQuickTable(skillMd, data),
  };
}

export const isSkillName = (name) => NAME.test(name);
