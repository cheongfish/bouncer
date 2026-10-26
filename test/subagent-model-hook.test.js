'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');

function runHook(payload, env = {}) {
  return spawnSync(process.execPath, [path.join(root, 'hooks/subagent-model.js')], {
    input: JSON.stringify(payload), encoding: 'utf8', cwd: os.tmpdir(),
    env: { ...process.env, ...env },
  });
}

test('Bouncer Agent hook registered → hook file and Agent matcher are available', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'hooks/hooks.json'), 'utf8'));
  const registered = config.hooks.PreToolUse.some((entry) => entry.matcher === 'Agent'
    && entry.hooks.some((hook) => hook.command === '${CLAUDE_PLUGIN_ROOT}/hooks/subagent-model.js'));
  assert.equal(registered, true);
  assert.equal(fs.statSync(path.join(root, 'hooks/subagent-model.js')).isFile(), true);
});

function makeRuntime({ output = 'claude-opus-5-5', exit = 0, body } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-model-'));
  const bin = path.join(dir, 'bouncer');
  const script = body || '#!/bin/sh\nprintf \'%s\' "$MODEL_OUTPUT"\nexit "$MODEL_EXIT"\n';
  fs.writeFileSync(bin, script, { mode: 0o755 });
  return { bin, env: { BOUNCER_BIN: bin, MODEL_OUTPUT: output, MODEL_EXIT: String(exit) } };
}

function invoke(payload, runtime) {
  return runHook(payload, runtime ? runtime.env : {});
}

function payload(type, extra = {}) {
  return {
    tool_name: 'Agent', cwd: os.tmpdir(),
    tool_input: { subagent_type: type, prompt: 'keep this prompt', permission_mode: 'default', ...extra },
  };
}

function parsedOutput(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('missing Bouncer model → public CLI value fills model and preserves input', () => {
  const rt = makeRuntime();
  const result = parsedOutput(invoke(payload('bouncer-implementer'), rt));
  assert.deepEqual(result.hookSpecificOutput.updatedInput, {
    subagent_type: 'bouncer-implementer', prompt: 'keep this prompt', permission_mode: 'default',
    model: 'claude-opus-5-5',
  });
  assert.match(result.hookSpecificOutput.additionalContext, /implementer.*누락.*claude-opus-5-5.*한국어/);
  assert.equal('permissionDecision' in result.hookSpecificOutput, false);
});

test('mismatched model → config model replaces it and reports previous value', () => {
  const rt = makeRuntime();
  const result = parsedOutput(invoke(payload('bouncer:bouncer-reviewer', { model: 'old-model' }), rt));
  assert.equal(result.hookSpecificOutput.updatedInput.model, 'claude-opus-5-5');
  assert.match(result.hookSpecificOutput.additionalContext, /"old-model".*설정 모델명/);
});

test('canonical and plugin namespace names → both resolve the canonical CLI role', () => {
  for (const name of ['bouncer-debugger', 'bouncer:bouncer-debugger']) {
    const rt = makeRuntime();
    const result = parsedOutput(invoke(payload(name, { model: 'old' }), rt));
    assert.equal(result.hookSpecificOutput.updatedInput.model, 'claude-opus-5-5');
  }
});

test('same model → no input rewrite or context message', () => {
  const rt = makeRuntime();
  const result = invoke(payload('bouncer-coordinator', { model: 'claude-opus-5-5' }), rt);
  assert.equal(result.stdout, '');
});

test('inherit with explicit model → removes model to restore inheritance', () => {
  const rt = makeRuntime({ output: 'inherit' });
  const result = parsedOutput(invoke(payload('bouncer-context-reviewer', { model: 'old' }), rt));
  assert.deepEqual(result.hookSpecificOutput.updatedInput, {
    subagent_type: 'bouncer-context-reviewer', prompt: 'keep this prompt', permission_mode: 'default',
  });
  assert.match(result.hookSpecificOutput.additionalContext, /상속/);
});

test('inherit without explicit model → no rewrite', () => {
  const rt = makeRuntime({ output: 'inherit' });
  assert.equal(invoke(payload('bouncer-reviewer'), rt).stdout, '');
});

test('other tool, foreign namespace, suffix, and unknown role → no runtime lookup', () => {
  const broken = { env: { BOUNCER_BIN: 'relative/path' } };
  for (const p of [
    { ...payload('bouncer-reviewer'), tool_name: 'Bash' },
    payload('other:bouncer-bouncer-reviewer'), payload('bouncer-reviewer-extra'),
    payload('bouncer-unknown'),
  ]) {
    const result = invoke(p, broken);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  }
});

test('runtime not found → exit 2 with Korean recovery guidance', () => {
  const result = runHook(payload('bouncer-reviewer'), { BOUNCER_BIN: 'relative/path' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /reviewer.*bouncer CLI.*BOUNCER_BIN/);
  assert.match(result.stderr, /subagent-model --agent bouncer-reviewer --provider claude --repo <cwd>/);
});

test('runtime nonzero exit → exit 2 with cause and recovery guidance', () => {
  const result = invoke(payload('bouncer-reviewer'), makeRuntime({ exit: 7 }));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /exit 7.*Bouncer CLI 설정/);
  assert.match(result.stderr, /subagent-model --agent bouncer-reviewer --provider claude --repo <cwd>/);
});

test('diagnostic line, padded token, control character, and multiple lines → exit 2', () => {
  for (const output of ['warning: model unavailable', ' opus', 'bad\u0001token', 'opus\nother']) {
    const result = invoke(payload('bouncer-reviewer'), makeRuntime({ output }));
    assert.equal(result.status, 2, JSON.stringify(output));
    assert.match(result.stderr, /단일 모델 토큰/);
    assert.match(result.stderr, /subagent-model --agent bouncer-reviewer --provider claude --repo <cwd>/);
  }
});

test('single model token and one LF or CRLF terminator → accepted', () => {
  for (const output of ['opus', 'claude-opus-5-5[1m]', 'claude-opus-5-5\n', 'claude-opus-5-5\r\n']) {
    const result = parsedOutput(invoke(payload('bouncer-reviewer'), makeRuntime({ output })));
    assert.equal(result.hookSpecificOutput.updatedInput.model, output.replace(/[\r\n]+$/, ''));
  }
});

test('runtime output with trailing blank line → exit 2', () => {
  const result = invoke(payload('bouncer-reviewer'), makeRuntime({ output: 'opus\n\n' }));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /단일 모델 토큰/);
});

test('runtime timeout → exit 2 with timeout and recovery guidance', () => {
  const rt = makeRuntime({ body: '#!/bin/sh\nsleep 30\n' });
  const result = invoke(payload('bouncer-reviewer'), rt);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /시간이 초과.*다시 시도/);
  assert.match(result.stderr, /subagent-model --agent bouncer-reviewer --provider claude --repo <cwd>/);
});

test('cwd with invalid type → exit 2 without invoking runtime', () => {
  const result = invoke({ ...payload('bouncer-reviewer'), cwd: 42 }, { env: { BOUNCER_BIN: 'relative/path' } });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /저장소 경로.*다시 시도/);
  assert.match(result.stderr, /subagent-model --agent bouncer-reviewer --provider claude --repo <cwd>/);
});
