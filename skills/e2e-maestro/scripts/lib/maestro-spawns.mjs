// maestro-spawns.mjs: the maestro-device rule, shared by e2e-maestro's check-e2e-setup and
// ios-simulator-build's check-sim-setup (a helper, not an entry point).
//
// Several sessions share one Mac. A Maestro run that does not name its simulator, or that uses the
// default XCTest driver port 7001, can drive another session's simulator: round 3's hierarchy call
// answered from another session's device. So every spawn of the Maestro binary in repo tooling
// starts its arguments with the global flags, before the command:
//   maestro --device <udid> --driver-host-port <port> test ...
// built with the repo's maestroGlobalArgs({ udid, driverPort }) (packages/tooling/src/e2e/
// maestro-args.ts), where the port comes from freeDriverPort() per run or the session's own
// --driver-port. Maestro's per-command --udid is not enough (it leaves the driver port shared).
//
// maestroSpawnProblems(files) takes [{ rel, code }] (code with comments masked, strings kept) for
// every non-test tooling source and returns [{ file, line, message, fix }]:
//   - a spawn of the binary whose arguments (inline, through one const, or through one tooling
//     function that builds them) neither call maestroGlobalArgs nor put '--device' and
//     '--driver-host-port' before the command;
//   - Maestro's per-command '--udid' anywhere in the tooling;
//   - a fixed driver port ('--driver-host-port', '7001' or driverPort: 7001).
// A spawn whose command is --version or check-syntax needs no device and is left alone.

const IDENT = String.raw`[A-Za-z_$][\w$]*`;
/** join(..., 'maestro', 'bin', 'maestro') or a path string ending in maestro/bin/maestro. */
const BINARY_VALUE = String.raw`(?:join\([^)]*['"]maestro['"]\s*,\s*['"]bin['"]\s*,\s*['"]maestro['"]\s*\)|['"\`][^'"\`\n]*maestro/bin/maestro['"\`])`;
const BINDING = new RegExp(String.raw`(?:export\s+)?(?:const|let)\s+(${IDENT})\s*=\s*${BINARY_VALUE}`, 'g');
const SPAWNERS = String.raw`(?:spawnSync|spawn|execFileSync|execFile|execa|execaSync)`;
const COMMANDS = ['test', 'hierarchy', 'record', 'start-device', 'studio', 'mcp', 'download-samples', 'cloud', 'login'];
const NO_DEVICE = /^\s*\[\s*['"](?:--version|-v|check-syntax)['"]/;

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** The expression that starts at `from`: up to the first , ) ; or } at depth 0. */
function expressionAt(code, from) {
  let depth = 0;
  let quote = null;
  for (let i = from; i < code.length; i += 1) {
    const ch = code[i];
    if (quote !== null) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) {
      if (depth === 0) return code.slice(from, i).trim();
      depth -= 1;
    } else if ((ch === ',' || ch === ';') && depth === 0) return code.slice(from, i).trim();
  }
  return code.slice(from).trim();
}

/** The body of `function name(...) {...}` or `const name = (...) => ...` in any of the files. */
function functionBody(files, name) {
  const declared = new RegExp(String.raw`(?:function\s+${name}\s*\(|(?:const|let)\s+${name}\s*=\s*(?:async\s*)?\()`);
  for (const { code } of files) {
    const match = declared.exec(code);
    if (!match) continue;
    const open = code.indexOf('{', match.index);
    if (open === -1) continue;
    let depth = 0;
    for (let i = open; i < code.length; i += 1) {
      if (code[i] === '{') depth += 1;
      else if (code[i] === '}' && (depth -= 1) === 0) return code.slice(open, i + 1);
    }
  }
  return '';
}

/** Whether argument text puts --device and --driver-host-port before the Maestro command. */
function flagsFirst(text) {
  const words = [...text.matchAll(/['"]([^'"\n]+)['"]/g)].map((match) => match[1]);
  const command = words.findIndex((word) => COMMANDS.includes(word));
  const before = command === -1 ? words : words.slice(0, command);
  return before.includes('--device') && before.includes('--driver-host-port');
}

/**
 * True when the argument expression (resolved one const and one builder deep) names both. A bare
 * name resolves to its nearest const or let before the spawn (a file may reuse the name `args`).
 */
function namesDevice(files, file, expression, at) {
  const texts = [expression];
  const bare = /^(\w+)$/.exec(expression)?.[1];
  if (bare) {
    const assignments = [...file.code.slice(0, at).matchAll(new RegExp(String.raw`(?:const|let)\s+${bare}\s*=\s*`, 'g'))];
    const assigned = assignments.at(-1);
    if (assigned) texts.push(expressionAt(file.code, assigned.index + assigned[0].length));
  }
  for (const text of [...texts]) {
    for (const call of text.matchAll(new RegExp(String.raw`(${IDENT})\s*\(`, 'g'))) texts.push(functionBody(files, call[1]));
  }
  return texts.some((text) => /\bmaestroGlobalArgs\s*\(/.test(text) || flagsFirst(text));
}

/** Names bound to the Maestro binary: local consts plus names imported from a file that binds them. */
function binaryNames(files) {
  const exported = new Set();
  const local = new Map(files.map((file) => [file.rel, new Set()]));
  for (const file of files) {
    for (const match of file.code.matchAll(BINDING)) {
      local.get(file.rel).add(match[1]);
      exported.add(match[1]);
    }
  }
  for (const file of files) {
    for (const match of file.code.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
      for (const part of match[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        const original = part.trim().split(/\s+as\s+/)[0]?.replace(/^type\s+/, '').trim();
        if (name && original && exported.has(original)) local.get(file.rel).add(name);
      }
    }
  }
  return local;
}

const FIX_DEVICE = "Build the arguments with maestroGlobalArgs({ udid, driverPort }) from packages/tooling/src/e2e/maestro-args.ts (driverPort: await freeDriverPort() per run, or the session's --driver-port), before the command: maestro --device <udid> --driver-host-port <port> test ...";

export function maestroSpawnProblems(files) {
  const problems = [];
  const names = binaryNames(files);
  for (const file of files) {
    const { rel, code } = file;
    const bound = [...names.get(rel)];
    const targets = [...bound, String.raw`['"\`][^'"\`\n]*maestro/bin/maestro['"\`]`];
    for (const target of targets) {
      const spawnAt = new RegExp(String.raw`${SPAWNERS}\(\s*(?:${target})\s*,\s*`, 'g');
      for (const match of code.matchAll(spawnAt)) {
        const args = expressionAt(code, match.index + match[0].length);
        if (NO_DEVICE.test(args) || namesDevice(files, file, args, match.index)) continue;
        problems.push({ file: rel, line: lineOf(code, match.index), message: 'spawns Maestro without --device <udid> and --driver-host-port <port> before the command, so the run can reach another session\'s simulator or XCTest driver', fix: FIX_DEVICE });
      }
      if (target === targets.at(-1)) continue;
      // An exec step object: { file: MAESTRO_BIN, args } or { file: MAESTRO_BIN, args: [...] }.
      for (const match of code.matchAll(new RegExp(String.raw`\bfile\s*:\s*${target}\b`, 'g'))) {
        const rest = code.slice(match.index, code.indexOf('}', match.index) + 1);
        const named = /\bargs\s*:\s*/.exec(rest);
        const args = named ? expressionAt(rest, named.index + named[0].length) : /[,{]\s*args\s*[,}]/.test(rest) ? 'args' : '';
        if (NO_DEVICE.test(args) || namesDevice(files, file, args, match.index)) continue;
        problems.push({ file: rel, line: lineOf(code, match.index), message: 'runs Maestro without --device <udid> and --driver-host-port <port> before the command', fix: FIX_DEVICE });
      }
    }
    for (const match of code.matchAll(/['"]--udid['"]/g)) problems.push({ file: rel, line: lineOf(code, match.index), message: "passes Maestro's per-command --udid, which leaves the XCTest driver port shared with every other session", fix: FIX_DEVICE });
    for (const match of code.matchAll(/['"]--driver-host-port['"]\s*,\s*['"]?\d+|\bdriverPort\s*:\s*\d/g)) problems.push({ file: rel, line: lineOf(code, match.index), message: 'uses a fixed Maestro driver port, which a second run on this Mac shares', fix: 'Take a free port per run (freeDriverPort() in maestro-args.ts) or the port the session passes with --driver-port.' });
  }
  return problems;
}
