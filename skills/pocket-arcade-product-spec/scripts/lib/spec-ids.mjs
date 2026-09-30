// spec-ids.mjs: reads the spec entries out of this skill's references/*.md.
// Every entry is a heading "<#...> <ID> · <title>", where ID is a non-negotiable (N3), a screen
// (S9, S11a), an open decision (D4), a spec section (8.3, 13), a game id (line-siege) or a game's
// rules sheet (line-siege-rules, never a game id).
// The entry's text runs until the next heading of the same or a higher level.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The references folder sits two levels above this file: scripts/lib/ -> the skill root.
const REFERENCES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'references');
const HEADING = /^(#{1,4})\s+(\S+)\s+·\s+(.+?)\s*$/;
const ID_SHAPE = /^(N\d{1,2}|S\d{1,2}[a-d]?|D\d{1,2}|\d{1,2}(\.\d{1,2})?|[a-z]+(-[a-z]+)*)$/;

export function kindOf(id) {
  if (/-rules$/.test(id)) return 'rules sheet';
  if (/^N\d/.test(id)) return 'non-negotiable';
  if (/^S\d/.test(id)) return 'screen';
  if (/^D\d/.test(id)) return 'decision';
  if (/^\d/.test(id)) return 'section';
  return 'game';
}

/** Canonical form of a user-typed ID: "s11A" -> "S11a", "spec 8.3" -> "8.3", "Line-Siege" -> "line-siege". */
export function normalizeId(raw) {
  let text = String(raw).trim().replace(/[.,;:)]+$/, '').replace(/^\(/, '');
  text = text.replace(/^spec(?:'s)?\s*/i, '').replace(/^(sections?|§)\s*/i, '');
  const letter = /^([snd])(\d{1,2})([a-d]?)$/i.exec(text);
  if (letter) return `${letter[1].toUpperCase()}${Number(letter[2])}${letter[3].toLowerCase()}`;
  if (/^\d/.test(text)) return text;
  return text.toLowerCase();
}

/** All entries from references/*.md, in file order. */
export function loadEntries() {
  const entries = [];
  const files = readdirSync(REFERENCES).filter((name) => name.endsWith('.md')).sort();
  for (const name of files) {
    const lines = readFileSync(join(REFERENCES, name), 'utf8').split('\n');
    const heads = [];
    let fence = false;
    lines.forEach((line, index) => {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      if (fence) return;
      const match = /^(#{1,6})\s/.exec(line);
      if (!match) return;
      const full = HEADING.exec(line);
      const id = full && ID_SHAPE.test(full[2]) ? full[2] : null;
      heads.push({ index, level: match[1].length, id, title: full ? full[3] : line.replace(/^#+\s*/, '') });
    });
    heads.forEach((head, i) => {
      if (!head.id) return;
      const next = heads.slice(i + 1).find((other) => other.level <= head.level);
      const end = next ? next.index : lines.length;
      const text = lines.slice(head.index, end).join('\n').trimEnd();
      entries.push({ id: head.id, kind: kindOf(head.id), title: head.title, file: `references/${name}`, line: head.index + 1, text });
    });
  }
  return entries;
}

/** Map of canonical ID -> entry. */
export function loadIndex() {
  return new Map(loadEntries().map((entry) => [entry.id, entry]));
}
