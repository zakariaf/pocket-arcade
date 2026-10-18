// live-route.mjs: asks Claude Code itself which skill it would load for a prompt. Runs
// `claude -p <prompt> --output-format stream-json --verbose` in the repo, reads the event stream,
// and stops the run at the first deciding tool call: a Skill call names the chosen skill; any other
// tool (Read, an Edit, a Bash that does work ...) or a plain answer counts as "no skill". The session
// start a repo's AGENTS.md asks for comes first and decides nothing: a read-only Bash of git status,
// git log, git diff and npm run -s check:fast, and the routing index skill (pocket-arcade-index),
// which names the skill to load next. Costs one short model call per run.
import { spawn } from 'node:child_process';

/** Resolves { skill: string | null, firstTool: string | null, error?: string } for one prompt. */
export function routeLive(prompt, { cwd, claude = 'claude', timeoutMs = 120000 } = {}) {
  return new Promise((resolvePromise) => {
    const env = { ...process.env };
    // A nested Claude Code refuses to start while these point at the parent session.
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;
    let child;
    try {
      child = spawn(claude, ['-p', prompt, '--output-format', 'stream-json', '--verbose'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolvePromise({ skill: null, firstTool: null, error: error.message });
      return;
    }
    let buffer = '';
    let stderr = '';
    let settled = false;
    let firstTool = null;
    const seen = [];
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGTERM');
      resolvePromise(result);
    };
    const timer = setTimeout(() => finish({ skill: null, firstTool: null, error: `no answer within ${timeoutMs / 1000} s` }), timeoutMs);
    child.on('error', (error) => finish({ skill: null, firstTool: null, error: error.code === 'ENOENT' ? `${claude} is not installed or not on PATH` : error.message }));
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line.startsWith('{')) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (event.type === 'assistant') {
          for (const call of (event.message?.content ?? []).filter((block) => block.type === 'tool_use')) {
            const step = routeStep(call, seen);
            if (step.isDecided) finish({ skill: step.skill, firstTool: firstTool ?? call.name });
            firstTool ??= call.name;
            seen.push(call);
          }
        } else if (event.type === 'result') {
          finish({ skill: indexSkillOf(seen), firstTool, error: event.is_error ? String(event.result ?? 'error result') : undefined });
        }
      }
    });
    child.on('close', (code) => finish({ skill: null, firstTool: null, error: code === 0 ? undefined : `claude exited ${code}: ${stderr.trim().split('\n').pop() ?? ''}` }));
  });
}

/** The routing index a repo's AGENTS.md starts every task with; it names the skill to load next. */
const INDEX_SKILL = 'pocket-arcade-index';
/** Session-start steps a routed run may take before it decides (AGENTS.md "At the start of every session"). */
const MAX_START_STEPS = 4;
// Read-only only: no redirect, pipe or --output (git diff --output writes a file).
const SESSION_START_COMMAND = /^(?:git status|git (?:log|diff)(?: (?![^&;|>]*--output)[^&;|>]*)?|npm run -s check:fast)$/;

/** The skill a Skill call loads (a plugin prefix dropped), or null. */
function skillOf(call) {
  return call.name === 'Skill' ? String(call.input?.skill ?? '').replace(/^.*:/, '') || null : null;
}

/** A read-only session-start Bash: each part (joined by && or ;) is git status, log, diff or check:fast. */
function isSessionStartBash(call) {
  if (call.name !== 'Bash') return false;
  const parts = String(call.input?.command ?? '').split(/&&|;/).map((part) => part.trim());
  return parts.length > 0 && parts.every((part) => SESSION_START_COMMAND.test(part));
}

/** pocket-arcade-index when it was loaded and nothing more specific followed, else null. */
function indexSkillOf(seen) {
  return seen.some((call) => skillOf(call) === INDEX_SKILL) ? INDEX_SKILL : null;
}

/**
 * One tool call of the run: a skill other than the index decides it; the session start (a read-only
 * git status / log / diff or check:fast Bash, the index skill) does not, up to MAX_START_STEPS calls;
 * any other call decides "no skill", or the index when the index was what the run loaded.
 */
export function routeStep(call, seen) {
  const skill = skillOf(call);
  if (skill !== null && skill !== INDEX_SKILL) return { isDecided: true, skill };
  const isStart = skill === INDEX_SKILL || isSessionStartBash(call);
  if (isStart && seen.length < MAX_START_STEPS) return { isDecided: false };
  return { isDecided: true, skill: indexSkillOf([...seen, call]) };
}
