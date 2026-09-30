// skill-md.mjs: reads a skill folder's SKILL.md into its parts (frontmatter, sections, Files table,
// rules, related skills) for the skill-maintenance checkers. Zero dependencies.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const SECTIONS = ['Rules that must hold', 'Workflow', 'Definition of done', 'Anti-patterns', 'Files in this skill', 'Related skills'];
export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Parses one frontmatter value: plain, "double quoted" or 'single quoted'. */
function scalar(raw) {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1).replace(/\\(["\\nt])/g, (_, ch) => ({ n: '\n', t: '\t' })[ch] ?? ch);
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

/** Blanks fenced code blocks (keeps line count) and returns [{ text, inFence }] per line. */
function fenceMap(lines) {
  let fence = null;
  return lines.map((line) => {
    const opener = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      if (opener && line.trim().startsWith(fence)) fence = null;
      return { text: line, inFence: true };
    }
    if (opener) {
      fence = opener[1];
      return { text: line, inFence: true };
    }
    return { text: line, inFence: false };
  });
}

/** Markdown text with fenced blocks and inline code blanked (line numbers kept). */
export function proseOnly(text) {
  return fenceMap(text.split('\n'))
    .map(({ text: line, inFence }) => (inFence ? '' : line.replace(/(`+)([\s\S]*?)\1/g, (match) => ' '.repeat(match.length))))
    .join('\n');
}

/** List items of a section: numbered ("1. ") or dashed ("- "), with continuation lines joined. */
function listItems(section, marker) {
  const items = [];
  section.lines.forEach((line, i) => {
    const match = marker.exec(line);
    if (match) items.push({ text: line.slice(match[0].length), line: section.line + 1 + i });
    else if (items.length > 0 && /^\s{2,}\S/.test(line)) items[items.length - 1].text += ` ${line.trim()}`;
  });
  return items;
}

/** Reads skills/<name>/SKILL.md. Returns null when the folder has no SKILL.md. */
export function readSkill(dir) {
  const path = join(dir, 'SKILL.md');
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const frontmatter = {};
  let bodyStart = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) {
      for (const line of lines.slice(1, end)) {
        const match = /^([A-Za-z0-9_-]+):\s?(.*)$/.exec(line);
        if (match) frontmatter[match[1]] = scalar(match[2]);
      }
      bodyStart = end + 1;
    }
  }
  const mapped = fenceMap(lines);
  const heads = [];
  mapped.forEach(({ text: line, inFence }, index) => {
    if (inFence || index < bodyStart) return;
    const match = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
    if (match) heads.push({ level: match[1].length, title: match[2], index });
  });
  const sections = new Map();
  for (const head of heads.filter((item) => item.level === 2)) {
    const next = heads.find((item) => item.index > head.index && item.level <= 2);
    sections.set(head.title, { title: head.title, line: head.index + 1, lines: lines.slice(head.index + 1, next ? next.index : lines.length) });
  }
  const empty = { line: 0, lines: [] };
  const files = (sections.get('Files in this skill') ?? empty).lines
    .map((line, i) => ({ line, number: (sections.get('Files in this skill')?.line ?? 0) + 1 + i }))
    .filter(({ line }) => /^\s*\|/.test(line))
    .map(({ line, number }) => ({ cells: line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()), line: number }))
    .filter(({ cells }) => !cells.every((cell) => /^:?-{3,}:?$/.test(cell)))
    .slice(1)
    .map(({ cells, line }) => ({ path: cellPath(cells[0] ?? ''), what: cells[1] ?? '', when: cells[2] ?? '', cellCount: cells.length, line }));
  return {
    dir,
    text,
    lines,
    frontmatter,
    sections,
    files,
    rules: listItems(sections.get('Rules that must hold') ?? empty, /^\d+\.\s+/),
    related: listItems(sections.get('Related skills') ?? empty, /^-\s+/),
    sectionText: (title) => (sections.get(title)?.lines ?? []).join('\n'),
  };
}

/** The path named in the first cell of a Files table row. */
export function cellPath(cell) {
  const code = /`([^`]+)`/.exec(cell);
  if (code) return code[1].trim();
  const link = /\[[^\]]*\]\(([^)\s]+)\)/.exec(cell);
  if (link) return link[1].trim();
  return cell.replace(/\*\*/g, '').trim();
}

/** Skill folder names (folders with a SKILL.md) directly under a skills root; [] if none. */
export function listSkills(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) return [];
  // statSync follows symlinks, so .claude/skills (links to skills/<name>) works as a root too.
  return readdirSync(root)
    .filter((name) => !name.startsWith('_') && !name.startsWith('.') && statSync(join(root, name), { throwIfNoEntry: false })?.isDirectory() && existsSync(join(root, name, 'SKILL.md')))
    .sort();
}

/** Skill names a description hands off to: kebab tokens inside parentheses after "Not for". */
export function notForNames(description) {
  const at = description.search(/\bNot for\b/);
  if (at === -1) return [];
  const names = [];
  for (const group of description.slice(at).matchAll(/\(([^)]*)\)/g)) {
    for (const token of group[1].matchAll(/(?<![\w-])[a-z0-9]+(?:-[a-z0-9]+)+(?![\w-])/g)) names.push(token[0]);
  }
  return [...new Set(names)];
}
