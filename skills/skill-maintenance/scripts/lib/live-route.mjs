// live-route.mjs: asks Claude Code itself which skill it would load for a prompt. Runs
// `claude -p <prompt> --output-format stream-json --verbose` in the repo, reads the event stream,
// and stops the run at the first tool call: a Skill call names the chosen skill; any other first
// tool (Read, Bash ...) or a plain answer counts as "no skill". Costs one short model call per run.
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
          const call = (event.message?.content ?? []).find((block) => block.type === 'tool_use');
          if (call) finish({ skill: call.name === 'Skill' ? String(call.input?.skill ?? '').replace(/^.*:/, '') || null : null, firstTool: call.name });
        } else if (event.type === 'result') {
          finish({ skill: null, firstTool: null, error: event.is_error ? String(event.result ?? 'error result') : undefined });
        }
      }
    });
    child.on('close', (code) => finish({ skill: null, firstTool: null, error: code === 0 ? undefined : `claude exited ${code}: ${stderr.trim().split('\n').pop() ?? ''}` }));
  });
}
