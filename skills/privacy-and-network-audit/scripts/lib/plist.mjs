// plist.mjs: reads Apple property lists (Info.plist, PrivacyInfo.xcprivacy, entitlements) into
// plain JS values. XML plists are parsed here; binary plists (as in a built .app) are converted
// with macOS `plutil`. Not an entry point.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { fail } from '../check-lib.mjs';

const ENTITIES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': "'" };
const decode = (text) => text.replace(/&(lt|gt|amp|quot|apos);/g, (entity) => ENTITIES[entity]);

/** Parse the XML form of a property list. Throws on malformed input. */
export function parseXmlPlist(xml) {
  const tokens = [...xml.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>([^<]*)/g)];
  let index = 0;
  const next = () => tokens[index++];
  const value = () => {
    const token = next();
    if (!token) throw new Error('unexpected end of plist');
    const [, closing, tag, selfClosing, text] = token;
    if (closing) throw new Error(`unexpected </${tag}>`);
    if (selfClosing) {
      if (tag === 'true') return true;
      if (tag === 'false') return false;
      if (tag === 'dict') return {};
      if (tag === 'array') return [];
      if (tag === 'string') return '';
      throw new Error(`unexpected <${tag}/>`);
    }
    if (tag === 'plist') {
      const inner = value();
      next();
      return inner;
    }
    if (tag === 'dict') {
      const out = {};
      for (;;) {
        const peek = tokens[index];
        if (!peek) throw new Error('unterminated <dict>');
        if (peek[1] && peek[2] === 'dict') {
          index += 1;
          return out;
        }
        const key = next();
        if (key[2] !== 'key') throw new Error(`expected <key>, got <${key[2]}>`);
        next(); // </key>
        out[decode(key[4])] = value();
      }
    }
    if (tag === 'array') {
      const out = [];
      for (;;) {
        const peek = tokens[index];
        if (!peek) throw new Error('unterminated <array>');
        if (peek[1] && peek[2] === 'array') {
          index += 1;
          return out;
        }
        out.push(value());
      }
    }
    next(); // the closing tag of a scalar
    if (tag === 'string' || tag === 'date' || tag === 'data') return decode(text);
    if (tag === 'integer' || tag === 'real') return Number(text);
    throw new Error(`unsupported <${tag}>`);
  };
  return value();
}

/** Read a plist file of either form. Binary plists need macOS plutil (exit 2 without it). */
export function readPlist(path) {
  const buffer = readFileSync(path);
  if (buffer.subarray(0, 6).toString('latin1') === 'bplist') {
    const result = spawnSync('plutil', ['-convert', 'xml1', '-o', '-', path], { encoding: 'utf8' });
    if (result.status !== 0) fail(`cannot read the binary plist ${path} (plutil: ${result.error?.message ?? result.stderr.trim()})`, 'Run on macOS, or convert it first: plutil -convert xml1 <file>.');
    return parseXmlPlist(result.stdout);
  }
  return parseXmlPlist(buffer.toString('utf8'));
}
