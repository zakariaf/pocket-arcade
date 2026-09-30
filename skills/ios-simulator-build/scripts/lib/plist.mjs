// plist.mjs: reads Apple property lists (XML directly, binary through macOS plutil) into plain JS.
// Zero dependencies. Only what Info.plist, entitlements and ExportOptions files use is supported:
// dict, array, string, integer, real, true, false, date (as string) and data (as base64 string).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { fail } from '../check-lib.mjs';

const ENTITIES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': "'" };

function decode(text) {
  return text.replace(/&(lt|gt|amp|quot|apos);|&#(\d+);|&#x([0-9a-f]+);/gi, (match, named, dec, hex) => {
    if (named) return ENTITIES[match];
    return String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16));
  });
}

/** Tokenise the XML body into tags and text, dropping comments, the prolog and the doctype. */
function tokens(xml) {
  const body = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/i, '');
  const out = [];
  const re = /<(\/?)([A-Za-z]+)(?:\s+[^>]*?)?\s*(\/?)>|([^<]+)/g;
  for (const match of body.matchAll(re)) {
    if (match[2]) out.push({ close: match[1] === '/', name: match[2], empty: match[3] === '/' });
    else if (match[4].trim() !== '') out.push({ text: match[4] });
  }
  return out;
}

function parseValue(list, state) {
  const token = list[state.i];
  if (!token || token.text !== undefined || token.close) fail(`malformed plist near token ${state.i}`, 'Check the file with plutil -lint.');
  state.i += 1;
  const { name, empty } = token;
  if (name === 'true' || name === 'false') {
    if (!empty) state.i += 1;
    return name === 'true';
  }
  if (name === 'dict') return empty ? {} : parseDict(list, state);
  if (name === 'array') return empty ? [] : parseArray(list, state);
  if (empty) return name === 'string' ? '' : null;
  const text = list[state.i]?.text !== undefined ? list[state.i++].text : '';
  state.i += 1; // closing tag
  if (name === 'integer') return Number.parseInt(text.trim(), 10);
  if (name === 'real') return Number.parseFloat(text.trim());
  if (name === 'data') return text.replace(/\s+/g, '');
  return decode(text);
}

function parseDict(list, state) {
  const dict = {};
  while (list[state.i] && !(list[state.i].close && list[state.i].name === 'dict')) {
    const keyTag = list[state.i];
    if (keyTag.name !== 'key') fail(`plist dict entry without <key> near token ${state.i}`, 'Check the file with plutil -lint.');
    state.i += 1;
    const key = list[state.i]?.text !== undefined ? decode(list[state.i++].text) : '';
    state.i += 1; // </key>
    dict[key] = parseValue(list, state);
  }
  state.i += 1;
  return dict;
}

function parseArray(list, state) {
  const array = [];
  while (list[state.i] && !(list[state.i].close && list[state.i].name === 'array')) array.push(parseValue(list, state));
  state.i += 1;
  return array;
}

/** Parse XML plist text. */
export function parsePlistXml(xml) {
  const list = tokens(xml);
  const start = list.findIndex((token) => token.name === 'plist' && !token.close);
  if (start === -1) fail('not an XML property list (no <plist> element)', 'Pass an Info.plist, entitlements or ExportOptions file.');
  const state = { i: start + 1 };
  return parseValue(list, state);
}

/** Read a plist file: XML directly, binary (bplist00) through `plutil -convert xml1`. */
export function readPlist(path) {
  const buffer = readFileSync(path);
  if (buffer.subarray(0, 8).toString('latin1') === 'bplist00') {
    const result = spawnSync('plutil', ['-convert', 'xml1', '-o', '-', path], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      fail(`${path} is a binary plist and plutil could not convert it (${result.error?.message ?? result.stderr.trim()})`, 'Run on macOS, where /usr/bin/plutil exists.');
    }
    return parsePlistXml(result.stdout);
  }
  return parsePlistXml(buffer.toString('utf8'));
}

/** Read a dotted key path such as "NSAppTransportSecurity.NSAllowsArbitraryLoads". */
export function plistGet(object, keyPath) {
  return keyPath.split('.').reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), object);
}
