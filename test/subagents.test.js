'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  resolveSubagentModel, resolveSubagentDispatch, resolveSubagentRole,
} = require('../packages/cli/dist/subagents');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-subagents-'));
}

function writeConfig(repo, config) {
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify(config));
}

test('resolveSubagentModel → assembles canonical dispatch metadata', () => {
  const repo = tmpRepo();
  writeConfig(repo, SAMPLE);
  assert.deepStrictEqual(
    resolveSubagentDispatch({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
    { agent: 'bouncer-reviewer', provider: 'claude', model: 'claude-opus-4-6' },
  );
  assert.deepStrictEqual(
    resolveSubagentDispatch({
      repoRoot: repo, agentName: 'bouncer-reviewer', provider: 'codex',
    }),
    { agent: 'bouncer-reviewer', provider: 'codex', model: 'gpt-5.3-codex' },
  );
  assert.deepStrictEqual(
    resolveSubagentDispatch({ repoRoot: repo, agentName: 'bouncer-implementer', provider: 'codex' }),
    { agent: 'bouncer-implementer', provider: 'codex', model: null },
  );
});

const SAMPLE = {
  subagents: {
    provider: 'claude',
    claude: {
      'bouncer-reviewer': 'claude-opus-4-6',
      'bouncer-implementer': 'inherit',
      'bouncer-debugger': 'claude-sonnet-4-6',
      'bouncer-context-reviewer': 'claude-opus-4-6',
      'bouncer-coordinator': 'claude-opus-4-6',
    },
    cursor: {
      'bouncer-reviewer': 'composer-2.5-fast',
      'bouncer-implementer': 'inherit',
      'bouncer-debugger': 'inherit',
      'bouncer-context-reviewer': 'inherit',
      'bouncer-coordinator': 'inherit',
    },
    codex: {
      'bouncer-reviewer': 'gpt-5.3-codex',
      'bouncer-implementer': 42,
      'bouncer-debugger': 'gpt-5.3-codex',
      'bouncer-context-reviewer': 'gpt-5.3-codex',
      'bouncer-coordinator': 42,
    },
  },
};

test('provider argument → wins over config.subagents.provider', () => {
  const repo = tmpRepo();
  writeConfig(repo, SAMPLE);
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-reviewer',
      provider: 'cursor',
    }),
    { model: 'composer-2.5-fast', provider: 'cursor' },
  );
});

test('the four allowed providers → each resolves as given', () => {
  const repo = tmpRepo();
  writeConfig(repo, {});
  for (const provider of ['claude', 'cursor', 'codex', 'antigravity']) {
    assert.strictEqual(
      resolveSubagentRole({ repoRoot: repo, agentName: 'bouncer-reviewer', provider }).provider, provider,
    );
  }
});

test('provider outside the allowed list → role-config-invalid without echoing the value', () => {
  const repo = tmpRepo();
  writeConfig(repo, {});
  for (const provider of ['gpt\nx', 'a\0b', 'openai']) {
    const result = resolveSubagentRole({ repoRoot: repo, agentName: 'bouncer-reviewer', provider });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, 'role-config-invalid');
    assert.strictEqual(result.next, '--provider');
    assert.strictEqual(result.provider, null);
    assert.ok(!JSON.stringify(result).includes(provider.slice(0, 2) === 'gp' ? 'gpt' : provider));
    assert.strictEqual(resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer', provider }).model, null);
  }
});

test('invalid config.subagents.provider → rejected with its key, valid override wins', () => {
  const repo = tmpRepo();
  writeConfig(repo, { subagents: { provider: 'bad\nvalue' } });
  const bad = resolveSubagentRole({ repoRoot: repo, agentName: 'bouncer-reviewer' });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.code, 'role-config-invalid');
  assert.strictEqual(bad.next, 'subagents.provider');
  assert.ok(!JSON.stringify(bad).includes('bad'));
  const ok = resolveSubagentRole({ repoRoot: repo, agentName: 'bouncer-reviewer', provider: 'codex' });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.provider, 'codex');
});

test('config.subagents.provider when argument is omitted → is used', () => {
  const repo = tmpRepo();
  writeConfig(repo, SAMPLE);
  assert.deepStrictEqual(
    resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
    { model: 'claude-opus-4-6', provider: 'claude' },
  );
});

test('CLAUDE_PLUGIN_ROOT when config has no provider → implies claude', () => {
  const repo = tmpRepo();
  writeConfig(repo, {
    subagents: {
      claude: { 'bouncer-reviewer': 'claude-sonnet-4-6' },
    },
  });
  const prevClaude = process.env.CLAUDE_PLUGIN_ROOT;
  const prevPlugin = process.env.PLUGIN_ROOT;
  try {
    process.env.CLAUDE_PLUGIN_ROOT = '/tmp/fake-claude-plugin';
    delete process.env.PLUGIN_ROOT;
    assert.deepStrictEqual(
      resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
      { model: 'claude-sonnet-4-6', provider: 'claude' },
    );
  } finally {
    if (prevClaude === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
    else process.env.CLAUDE_PLUGIN_ROOT = prevClaude;
    if (prevPlugin === undefined) delete process.env.PLUGIN_ROOT;
    else process.env.PLUGIN_ROOT = prevPlugin;
  }
});

test('PLUGIN_ROOT alone when config has no provider → implies codex', () => {
  const repo = tmpRepo();
  writeConfig(repo, {
    subagents: {
      codex: { 'bouncer-reviewer': 'gpt-5.3-codex' },
    },
  });
  const prevClaude = process.env.CLAUDE_PLUGIN_ROOT;
  const prevPlugin = process.env.PLUGIN_ROOT;
  try {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    process.env.PLUGIN_ROOT = '/tmp/fake-codex-plugin';
    assert.deepStrictEqual(
      resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
      { model: 'gpt-5.3-codex', provider: 'codex' },
    );
  } finally {
    if (prevClaude === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
    else process.env.CLAUDE_PLUGIN_ROOT = prevClaude;
    if (prevPlugin === undefined) delete process.env.PLUGIN_ROOT;
    else process.env.PLUGIN_ROOT = prevPlugin;
  }
});

test('no provider signal → yields null model and null provider', () => {
  const repo = tmpRepo();
  writeConfig(repo, {
    subagents: {
      cursor: { 'bouncer-reviewer': 'composer-2.5-fast' },
    },
  });
  const prevClaude = process.env.CLAUDE_PLUGIN_ROOT;
  const prevPlugin = process.env.PLUGIN_ROOT;
  const prevHome = process.env.BOUNCER_HOME;
  const prevHostClaude = process.env.CLAUDECODE;
  const prevHostCodex = process.env.CODEX_THREAD_ID;
  try {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    delete process.env.PLUGIN_ROOT;
    // 테스트가 Claude Code·Codex 터미널 안에서 돌아도 호스트 변수가 새지 않게 한다.
    delete process.env.CLAUDECODE;
    delete process.env.CODEX_THREAD_ID;
    // BOUNCER_HOME must never count as a provider signal.
    process.env.BOUNCER_HOME = '/tmp/fake-bouncer-home';
    assert.deepStrictEqual(
      resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
      { model: null, provider: null },
    );
  } finally {
    if (prevClaude === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
    else process.env.CLAUDE_PLUGIN_ROOT = prevClaude;
    if (prevPlugin === undefined) delete process.env.PLUGIN_ROOT;
    else process.env.PLUGIN_ROOT = prevPlugin;
    if (prevHome === undefined) delete process.env.BOUNCER_HOME;
    else process.env.BOUNCER_HOME = prevHome;
    if (prevHostClaude === undefined) delete process.env.CLAUDECODE;
    else process.env.CLAUDECODE = prevHostClaude;
    if (prevHostCodex === undefined) delete process.env.CODEX_THREAD_ID;
    else process.env.CODEX_THREAD_ID = prevHostCodex;
  }
});

// plugin-root 변수가 없는 터미널에서도 호스트 세션 변수로 provider를 알아내야 한다.
// 그러지 못하면 provider가 null로 풀려 역할별 모델이 조용히 inherit가 된다.
function withEnv(patch, fn) {
  const keys = ['CLAUDE_PLUGIN_ROOT', 'PLUGIN_ROOT', 'CLAUDECODE', 'CODEX_THREAD_ID', 'CURSOR_AGENT'];
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, patch);
    return fn();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test('CLAUDECODE without plugin-root vars → implies claude', () => {
  const repo = tmpRepo();
  writeConfig(repo, { subagents: { claude: { 'bouncer-reviewer': 'claude-opus-5-5' } } });
  withEnv({ CLAUDECODE: '1' }, () => {
    assert.deepStrictEqual(
      resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
      { model: 'claude-opus-5-5', provider: 'claude' },
    );
  });
});

test('CODEX_THREAD_ID without plugin-root vars → implies codex', () => {
  const repo = tmpRepo();
  writeConfig(repo, { subagents: { codex: { 'bouncer-reviewer': 'gpt-6.1-sol' } } });
  withEnv({ CODEX_THREAD_ID: 'thread-1' }, () => {
    assert.deepStrictEqual(
      resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
      { model: 'gpt-6.1-sol', provider: 'codex' },
    );
  });
});

test('CURSOR_AGENT alone → stays unresolved because cursor needs an explicit pin', () => {
  const repo = tmpRepo();
  writeConfig(repo, { subagents: { cursor: { 'bouncer-reviewer': 'composer-2.5' } } });
  withEnv({ CURSOR_AGENT: '1' }, () => {
    assert.deepStrictEqual(
      resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
      { model: null, provider: null },
    );
  });
});

test('config.subagents.provider with a host variable → config pin wins', () => {
  const repo = tmpRepo();
  writeConfig(repo, {
    subagents: {
      provider: 'codex',
      claude: { 'bouncer-reviewer': 'claude-opus-5-5' },
      codex: { 'bouncer-reviewer': 'gpt-6.1-sol' },
    },
  });
  withEnv({ CLAUDECODE: '1' }, () => {
    assert.deepStrictEqual(
      resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
      { model: 'gpt-6.1-sol', provider: 'codex' },
    );
  });
});

test('config.subagents.provider antigravity → resolves the antigravity block', () => {
  const repo = tmpRepo();
  writeConfig(repo, {
    subagents: {
      provider: 'antigravity',
      antigravity: {
        'bouncer-reviewer': 'gemini-3-flash',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
      },
    },
  });
  assert.deepStrictEqual(
    resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
    { model: 'gemini-3-flash', provider: 'antigravity' },
  );
});

// Antigravity exports no plugin-root env. BOUNCER_HOME alone must not become
// provider: 'antigravity' even when an antigravity block is present.
test('BOUNCER_HOME alone → never resolves provider antigravity', () => {
  const repo = tmpRepo();
  writeConfig(repo, {
    subagents: {
      antigravity: {
        'bouncer-reviewer': 'some-model',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
      },
    },
  });
  const prevHome = process.env.BOUNCER_HOME;
  try {
    process.env.BOUNCER_HOME = '/tmp/fake-bouncer-home';
    // 호스트 세션 변수까지 비워야 BOUNCER_HOME만의 효과를 본다.
    withEnv({}, () => {
      assert.deepStrictEqual(
        resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
        { model: null, provider: null },
      );
    });
  } finally {
    if (prevHome === undefined) delete process.env.BOUNCER_HOME;
    else process.env.BOUNCER_HOME = prevHome;
  }
});

test('inherit and non-string values → return null model with resolved provider', () => {
  const repo = tmpRepo();
  writeConfig(repo, SAMPLE);
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-implementer',
      provider: 'cursor',
    }),
    { model: null, provider: 'cursor' },
  );
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-implementer',
      provider: 'codex',
    }),
    { model: null, provider: 'codex' },
  );
});

test('missing agent key → returns null model with resolved provider', () => {
  const repo = tmpRepo();
  writeConfig(repo, SAMPLE);
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'unknown-agent',
      provider: 'claude',
    }),
    { model: null, provider: 'claude' },
  );
});

test('resolveSubagentModel → returns provider values for bouncer-debugger', () => {
  const repo = tmpRepo();
  writeConfig(repo, SAMPLE);
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-debugger',
      provider: 'claude',
    }),
    { model: 'claude-sonnet-4-6', provider: 'claude' },
  );
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-debugger',
      provider: 'cursor',
    }),
    { model: null, provider: 'cursor' },
  );
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-debugger',
      provider: 'codex',
    }),
    { model: 'gpt-5.3-codex', provider: 'codex' },
  );
});

test('resolveSubagentModel → returns provider values for bouncer-context-reviewer', () => {
  const repo = tmpRepo();
  writeConfig(repo, SAMPLE);
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-context-reviewer',
      provider: 'claude',
    }),
    { model: 'claude-opus-4-6', provider: 'claude' },
  );
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-context-reviewer',
      provider: 'cursor',
    }),
    { model: null, provider: 'cursor' },
  );
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-context-reviewer',
      provider: 'codex',
    }),
    { model: 'gpt-5.3-codex', provider: 'codex' },
  );
});

test('resolveSubagentModel → miss for bouncer-debugger yields null model', () => {
  const repo = tmpRepo();
  writeConfig(repo, {
    subagents: {
      claude: { 'bouncer-reviewer': 'claude-opus-4-6' },
    },
  });
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-debugger',
      provider: 'claude',
    }),
    { model: null, provider: 'claude' },
  );
});

test('missing config / broken JSON / missing subagents → do not throw', () => {
  const missing = tmpRepo();
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: missing,
      agentName: 'bouncer-reviewer',
      provider: 'cursor',
    }),
    { model: null, provider: 'cursor' },
  );

  const broken = tmpRepo();
  fs.mkdirSync(path.join(broken, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(broken, '.bouncer/config.json'), '{broken');
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: broken,
      agentName: 'bouncer-reviewer',
      provider: 'cursor',
    }),
    { model: null, provider: 'cursor' },
  );

  const noBlock = tmpRepo();
  writeConfig(noBlock, { verify: 'npm test' });
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: noBlock,
      agentName: 'bouncer-reviewer',
      provider: 'cursor',
    }),
    { model: null, provider: 'cursor' },
  );
});

// coordinator도 다른 named dispatch와 같은 rules/subagent-model.md 계약을 쓴다.
// 슬롯이 없거나 inherit/비문자열이면 model 인자를 생략해 부모 세션을 상속한다.
test('resolveSubagentModel → returns provider values for bouncer-coordinator', () => {
  const repo = tmpRepo();
  writeConfig(repo, SAMPLE);
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-coordinator',
      provider: 'claude',
    }),
    { model: 'claude-opus-4-6', provider: 'claude' },
  );
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-coordinator',
      provider: 'cursor',
    }),
    { model: null, provider: 'cursor' },
  );
  // 비문자열 값은 대체 모델 요청이 아니라 상속이다.
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-coordinator',
      provider: 'codex',
    }),
    { model: null, provider: 'codex' },
  );
});

test('resolveSubagentModel → miss for bouncer-coordinator yields null model', () => {
  const repo = tmpRepo();
  writeConfig(repo, {
    subagents: {
      claude: { 'bouncer-reviewer': 'claude-opus-4-6' },
    },
  });
  assert.deepStrictEqual(
    resolveSubagentModel({
      repoRoot: repo,
      agentName: 'bouncer-coordinator',
      provider: 'claude',
    }),
    { model: null, provider: 'claude' },
  );
});

// 모델 거절 중단과 named-agent 부재 fallback 모두 같은 coordinator 역할을
// 넘겨야 한다. 계약이 model 규칙에만 있고 fallback brief를 줄이면, 위임받은
// 쪽이 worktree guard 없이 drive를 시작한다.
test('coordinator dispatch → shares the model contract and keeps its full fallback brief', () => {
  const contract = fs.readFileSync(
    path.join(__dirname, '..', 'rules/subagent-model.md'), 'utf8',
  );
  assert.match(contract, /bouncer-coordinator/);
  assert.match(contract, /model rejection[\s\S]{0,160}stop/i);
  assert.match(contract, /named agents are unavailable/i);
  const coordinatorClause = contract.match(/`\/bouncer-run` resolves[\s\S]*?(?=\n\n)/)?.[0] || '';
  assert.match(coordinatorClause, /whole coordinator role/i);
  assert.match(coordinatorClause, /worktree write boundary/i);
  assert.match(coordinatorClause, /never a shortened\s+brief/i);
});

// Codex는 전체 대화를 잇는 fork에 model 지정을 받지 않는다. 1번 항목이 slug를
// 넘길 때 fork_turns "none"을 함께 지정하라고 말하지 않으면, 공통 규칙만 따르는
// run·execute 호출에서 config의 역할별 모델이 적용되지 않고 부모 모델로 돈다.
test('Codex slug dispatch → item 1 requires fork_turns "none" with the model', () => {
  const contract = fs.readFileSync(
    path.join(__dirname, '..', 'rules/subagent-model.md'), 'utf8',
  );
  const item1 = contract.match(/\n1\. Resolve[\s\S]*?(?=\n2\. )/)?.[0] || '';
  assert.match(item1, /Codex/);
  assert.match(item1, /`fork_turns: "none"`/);
  assert.match(item1, /slug/);
});

test('model tier docs → item 1, cli.md, configuration.md state the tier/effort contract', () => {
  const norm = (t) => t.replace(/\s+/g, ' ');
  const item1 = norm(readRepo('rules/subagent-model.md').match(/\n1\. Resolve[\s\S]*?(?=\n2\. )/)?.[0] || '');
  for (const sentence of [
    'If the command exits 1, do not dispatch; report its code, provider, role, tier, and the config key to fix.',
    'On Codex, pass the role effort as the spawn reasoning_effort.',
    'On Cursor, do not pass the role effort; tell the user the configured effort was not applied because the model slug carries it.',
    'On Claude Code, pass the role effort as the Agent effort argument; the hook corrects it.',
    'Run bouncer subagent-model --agent <name> --json to read provider, role, tier, model, effort, and source.',
  ]) {
    assert.ok(item1.includes(sentence), sentence);
  }
  assert.ok(item1.includes('subagents.<provider>.<agent>'));
  assert.ok(!item1.includes('and every non-string configured value have that inheritance'));

  const cli = readRepo('rules/cli.md');
  assert.ok(cli.includes('bouncer subagent-model --agent <name> [--provider <name>] [--json]'));
  const para = cli.match(/`subagent-model` prints[\s\S]*?(?=\n\n)/)?.[0] || '';
  assert.ok(para.includes('--json') && para.includes('exit 1'));
  assert.ok(!para.includes('Do not\nparse it as'));
  const reason = cli.match(/^`reason` is [\s\S]*?(?=\n\n)/m)?.[0] || '';
  assert.ok(reason.includes('tier-unmapped') && reason.includes('role-config-invalid'));
  assert.ok(cli.match(/`dispatch print` runs[\s\S]*?(?=\n\n)/)?.[0].includes('effort'));

  const conf = readRepo('docs/configuration.md');
  for (const t of ['model_tiers', 'roles.<agent>.effort', 'tier-unmapped',
    'subagent-model --agent <name> --json', '직접 추가', 'tier-inherit']) {
    assert.ok(conf.includes(t), t);
  }
  assert.ok(!conf.includes('매핑이 있을 때만 `agent_dispatch.model`에 적용된다'));
});

test('dispatch history rule → item 1 isolates history independent of inherit', () => {
  const contract = fs.readFileSync(
    path.join(__dirname, '..', 'rules/subagent-model.md'), 'utf8',
  );
  const agentDispatch = fs.readFileSync(
    path.join(__dirname, '..', 'skills/bouncer-run/references/agent-dispatch.md'), 'utf8',
  );
  const item1 = (contract.match(/\n1\. Resolve[\s\S]*?(?=\n2\. )/)?.[0] || '')
    .replace(/\s+/g, ' ');
  const item3 = (contract.match(/\n3\. [\s\S]*?(?=\n4\. )/)?.[0] || '')
    .replace(/\s+/g, ' ');
  assert.ok(item1.includes('Every new dispatch starts without conversation history, whether the resolved model is a slug or `inherit`; this covers `bouncer-coordinator`, `bouncer-plan-coordinator`, `bouncer-planner`, `bouncer-implementer`, `bouncer-reviewer`, `bouncer-debugger`, `bouncer-context-reviewer`, and plan evidence agents.'));
  assert.ok(item1.includes('Host methods: Codex sets `fork_turns: "none"`; Claude Code uses a named subagent call and never a fork; Cursor print runs a separate process per dispatch.'));
  assert.ok(item1.includes('The only exceptions are an implementer continuing its own session for the first in-scope verify fix defined in `${BOUNCER_ROOT}/references/coordinator-cards/verify.md`, and a planner continuing its own session once to apply plan review must_fix findings.'));
  assert.doesNotMatch(item1, /stays whatever the calling workflow specifies/);
  assert.doesNotMatch(item1, /parent-session inheritance/);
  assert.match(item3, /stop and report the rejection/i);
  assert.ok(agentDispatch.includes('Every new worker dispatch starts without conversation history (item 1 of that rule).'));
});

// fallback payload는 dispatcher 지시문이 소유한다. 역할 문서 안에 "fallback으로
// 온전히 전달된다"고 적어 봐야 dispatcher가 그 문서를 보내지 않으면 읽히지
// 않는다. 그래서 실제로 실행되는 다섯 fallback 문단이 역할 문서 본문 전체와
// 역할별 controller 입력을 직접 명시하는지를 여기서 고정한다. 하나라도 역할
// 이름이나 "same brief" 같은 요약만 넘기면 축약된 역할이 판정을 통과한다.
const readRepo = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

// 문서는 80열 근처에서 줄바꿈되므로 문구의 공백 자리에 줄바꿈을 허용한다.
// 대소문자를 구분하고 단어 경계를 건다. 대소문자를 무시하면 절 이름 `Touch`가
// "Do not touch"에, `HEAD`가 아무 "head"에, `mode`가 "model"에 걸려서 입력
// 하나를 지워도 단언이 통과한다. `(?<!not\s)`는 "not Touch" 같은 부정 문맥을
// 절 이름으로 세지 않게 한다.
function wrapped(text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  const head = /^\w/.test(text) ? '(?<!not\\s)\\b' : '';
  const tail = /\w$/.test(text) ? '\\b' : '';
  return new RegExp(head + escaped + tail);
}

// start 문구부터 end 문구 직전까지를 fallback 문단으로 본다. 앵커가 사라지면
// 빈 문자열로 통과하지 않도록 즉시 실패시킨다. start는 줄바꿈을 넘는 문구라
// wrapped()로 찾는다. after가 있으면 그 앵커 뒤에서만 start를 찾는다 — 같은
// 파일에 같은 fallback 문구가 여러 역할 몫으로 있을 때 역할 문단을 고정한다.
function passage(rel, start, end, after) {
  const md = readRepo(rel);
  const base = after === undefined ? 0 : md.indexOf(after);
  assert.ok(base >= 0, `${rel}: missing section anchor ${JSON.stringify(after)}`);
  const hit = wrapped(start).exec(md.slice(base));
  assert.ok(hit, `${rel}: missing fallback anchor ${JSON.stringify(start)}`);
  const from = base + hit.index;
  const to = md.indexOf(end, from + hit[0].length);
  return md.slice(from, to === -1 ? undefined : to);
}

const REVIEWER_INPUTS = [
  'base', 'HEAD', 'task brief revision', 'mode', 'perspective', 'latest verify',
  'previous findings', 'revision diff', 'read-only cwd',
];

// inline: 그 경로에 inline pass가 있는지. inline pass는 판정 전에 역할 문서를
// 직접 읽어야 하므로 "first reads" 문구를 따로 본다. coordinator는 generic
// subagent 하나만 fallback으로 허용한다(rule 5).
// start는 fallback 문장 자체에서 시작한다. 앞의 named dispatch 문장("Freeze
// base, HEAD…", "resolved model", 여섯 절 목록)까지 잘라 오면 fallback이 입력을
// 빠뜨려도 앞 문장이 대신 통과시킨다.
// copies: 정본이 따로 있는 목록을 fallback이 베껴 오면 안 되는 필드. 베낀
// 목록은 정본과 어긋나도 테스트가 모른다.
const FALLBACK_SITES = [
  {
    role: 'context-reviewer',
    rel: 'skills/bouncer-plan/references/context-review.md',
    start: 'If named agents are unavailable',
    end: '\n\n',
    inline: true,
    inputs: [
      'mode', 'frozen target', 'digest', 'document list', 'perspective',
      'previous findings', 'read-only cwd',
    ],
  },
  {
    role: 'reviewer',
    rel: 'references/review/index.md',
    after: '3. **Review**',
    start: 'When named agents are unavailable',
    end: '\n\n',
    inline: true,
    inputs: REVIEWER_INPUTS,
  },
  {
    role: 'reviewer',
    rel: 'skills/bouncer-run/references/agent-dispatch.md',
    after: 'For review,',
    start: 'If named agents are unavailable',
    end: '\n\n',
    inline: true,
    inputs: REVIEWER_INPUTS,
  },
  {
    // debugger payload·fallback 정본은 agent-dispatch로 옮겨졌다. verification-recovery는
    // 링크만 두므로 아래 별도 테스트가 복제 부재를 본다.
    role: 'debugger',
    rel: 'skills/bouncer-run/references/agent-dispatch.md',
    after: '## Debugger dispatch',
    start: 'When named agents are unavailable',
    end: '\n\n',
    inline: true,
    inputs: [
      'failing verify evidence', 'Goal & intent', 'Interface', 'Touch',
      'Do not touch', 'Constraints', 'Checklist', 'assigned read-only cwd',
    ],
  },
  {
    role: 'implementer',
    rel: 'skills/bouncer-run/references/agent-dispatch.md',
    start: 'If the TOML is missing',
    end: '\n\n',
    inline: true,
    inputs: [
      'Goal & intent', 'Current behavior', 'Target behavior', 'Interface',
      'Touch', 'Do not touch', 'Constraints', 'Checklist', 'actual worktree cwd',
    ],
  },
  {
    // run step 4가 실제로 dispatch하는 coordinator fallback 문장. "same coordinator
    // brief" 라벨만 남으면 위임받은 쪽이 worktree guard 없이 drive를 시작한다.
    role: 'coordinator',
    rel: 'skills/bouncer-run/SKILL.md',
    start: 'When named agents are unavailable',
    end: '\n\n',
    inline: false,
    inputs: ['step 4 payload', 'worktree write boundary', 'item 5'],
  },
  {
    role: 'coordinator',
    rel: 'rules/subagent-model.md',
    start: '5. `/bouncer-run` resolves',
    end: '\n\n',
    inline: false,
    // payload 정의의 정본은 run step 4다. rule 5는 그것을 가리키기만 한다.
    inputs: ['`/bouncer-run` dispatch payload', '`skills/bouncer-run/SKILL.md` step 4'],
    copies: ['start selection', 'autonomy', 'base SHA'],
  },
];

for (const site of FALLBACK_SITES) {
  test(`${site.role} fallback in ${site.rel} → carries the whole role document and its controller input`, () => {
    const text = passage(site.rel, site.start, site.end, site.after);
    assert.match(text, wrapped(`entire body of \`\${BOUNCER_ROOT}/agents/bouncer-${site.role}.md\``));
    assert.match(text, /Authority\s+through\s+Output\s+contract/);
    for (const input of site.inputs) {
      assert.match(text, wrapped(input), `${site.rel}: missing controller input ${input}`);
    }
    if (site.inline) {
      assert.match(text, wrapped(`first reads \`\${BOUNCER_ROOT}/agents/bouncer-${site.role}.md\``));
    }
    for (const field of site.copies || []) {
      assert.doesNotMatch(text, wrapped(field), `${site.rel}: copies owner field ${field}`);
    }
    // 이전 요약 표현이 payload 정의로 돌아오면 역할 문서가 빠져도 통과한다.
    assert.doesNotMatch(text, /same (?:brief|prompt)\b/i);
  });
}

test('rule 4 → defines the same role brief as the whole role document plus controller input', () => {
  const rule = passage('rules/subagent-model.md', '4. When named agents are unavailable', '\n5. ');
  assert.match(rule, wrapped('same role brief'));
  assert.match(rule, wrapped('entire body of the role document `${BOUNCER_ROOT}/agents/bouncer-<role>.md`'));
  assert.match(rule, /Authority\s+through\s+Output\s+contract/);
  assert.match(rule, wrapped("calling workflow's controller input"));
  // 역할 이름·요약만 싣는 payload는 fallback이 아니다.
  assert.match(rule, /role name[\s\S]{0,120}summary[\s\S]{0,200}not a\s+fallback\s+payload/i);
  assert.match(rule, /inline[\s\S]{0,200}reads\s+that\s+role\s+document/i);
  // fallback은 named role보다 넓은 쓰기 권한이나 약한 scope 경계를 받지 않는다.
  assert.match(rule, wrapped('read-only role stays read-only'));
  assert.match(rule, /no\s+fallback\s+gains[\s\S]{0,120}(?:write|status|scope)/i);
  // named dispatch는 compact 원칙을 유지한다 — 전체 본문은 fallback 한정이다.
  assert.match(rule, /named\s+dispatch[\s\S]{0,160}(?:does not|never)\s+(?:carry|repeat)/i);
});

// 결과 본문 없는 completed 알림으로 metrics를 닫으면 중간값이 기록된다. item 6이
// 완료 판정과 metrics end 시점을, item 8이 지연 로드 툴 스키마 로드 순서를 말해야
// 모든 dispatcher가 같은 기준을 따른다.
test('dispatch rule → item 6 defines completed notices and metrics end timing, item 8 loads deferred tools', () => {
  const contract = fs.readFileSync(
    path.join(__dirname, '..', 'rules/subagent-model.md'), 'utf8',
  );
  const item6 = contract.match(/\n6\. [\s\S]*?(?=\n7\. )/)?.[0] || '';
  assert.match(item6, /`completed`/);
  assert.match(item6, /metrics end/);
  // 보고 완료 판정은 item 6이, 호스트별 usage 출처는 drive-metrics 표가 소유한다.
  // usage가 없다는 사실은 보고 미완료가 아니다 — 두 판정을 섞으면 대기가 끝나지 않는다.
  assert.match(item6, /drive-metrics\.md/);
  assert.match(item6, /host usage table/);
  assert.match(item6, /missing usage[\s\S]{0,80}not an unfinished report/i);
  const item8 = contract.match(/\n8\. [\s\S]*?(?=\n\n|$)/)?.[0] || '';
  assert.match(item8, /ToolSearch/);
});

// debugger fallback 본문이 verification-recovery에 다시 복제되면 두 정본이 어긋나도
// 위 FALLBACK_SITES가 한쪽만 본다. recovery는 실재하는 agent-dispatch 링크로만 넘긴다.
test('verification-recovery debugger dispatch → links agent-dispatch and carries no fallback body', () => {
  const md = readRepo('skills/bouncer-run/references/verification-recovery.md');
  assert.ok(md.includes('](./agent-dispatch.md)'), 'verification-recovery must link agent-dispatch');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'skills/bouncer-run/references/agent-dispatch.md')));
  assert.doesNotMatch(md, /entire\s+body\s+of/);
  assert.doesNotMatch(md, /--role debugger/);
});

// 공통 모델 규칙은 run worker의 payload·기록을 다시 적지 않고 정본을 조건부로 가리킨다.
// 모델 resolve·거절 중단·whole-role fallback·foreground 경계를 함께 보존한다.
test('subagent-model rule → points run workers at agent-dispatch without dropping its own boundaries', () => {
  const contract = readRepo('rules/subagent-model.md');
  const item4 = passage('rules/subagent-model.md', '4. When named agents are unavailable', '\n5. ');
  assert.match(item4, wrapped('read `${BOUNCER_ROOT}/skills/bouncer-run/references/agent-dispatch.md`'));
  assert.doesNotMatch(contract, /worker-(?:model|tokens) --blueprint/);
  assert.match(contract, /model rejection[\s\S]{0,160}stop/i);
  assert.match(contract, /runs in the foreground/);
});

// --- resolveSubagentRole: 등급·effort 해석 ---
const COORD = 'bouncer-coordinator';
const REVIEWER = 'bouncer-reviewer';

function roleRepo(config) {
  const repo = tmpRepo();
  writeConfig(repo, config);
  return repo;
}

function claudeConfig(extra) {
  return { subagents: { provider: 'claude', claude: {} }, ...extra };
}

const TIER_CLAUDE = { claude: { standard: 'claude-sonnet-5-5' } };

test('tier set and slot unset → resolves the mapped tier model with effort', () => {
  const repo = roleRepo(claudeConfig({
    roles: { [COORD]: { tier: 'standard', effort: 'medium' } },
    model_tiers: TIER_CLAUDE,
  }));
  assert.deepStrictEqual(
    resolveSubagentRole({ repoRoot: repo, agentName: COORD }),
    {
      ok: true, provider: 'claude', role: COORD, tier: 'standard',
      model: 'claude-sonnet-5-5', effort: 'medium', source: 'tier',
    },
  );
});

test('slot inherit with tier → source is tier', () => {
  const cfg = claudeConfig({
    roles: { [COORD]: { tier: 'standard', effort: 'medium' } },
    model_tiers: TIER_CLAUDE,
  });
  cfg.subagents.claude[COORD] = 'inherit';
  const r = resolveSubagentRole({ repoRoot: roleRepo(cfg), agentName: COORD });
  assert.strictEqual(r.source, 'tier');
  assert.strictEqual(r.model, 'claude-sonnet-5-5');
});

test('slot slug with tier → slot wins and effort still carried', () => {
  const cfg = claudeConfig({
    roles: { [COORD]: { tier: 'standard', effort: 'medium' } },
    model_tiers: TIER_CLAUDE,
  });
  cfg.subagents.claude[COORD] = 'claude-opus-5-5';
  const r = resolveSubagentRole({ repoRoot: roleRepo(cfg), agentName: COORD });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.source, 'slot');
  assert.strictEqual(r.model, 'claude-opus-5-5');
  assert.strictEqual(r.tier, null);
  assert.strictEqual(r.effort, 'medium');
});

test('tier unmapped for provider → error variant while resolveSubagentModel stays null without throwing', () => {
  const repo = roleRepo({
    subagents: { provider: 'codex', codex: {} },
    roles: { [COORD]: { tier: 'standard' } },
    model_tiers: { codex: { strong: 'gpt-6.1-sol' } },
  });
  const r = resolveSubagentRole({ repoRoot: repo, agentName: COORD });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'tier-unmapped');
  assert.strictEqual(r.tier, 'standard');
  assert.deepStrictEqual(
    resolveSubagentModel({ repoRoot: repo, agentName: COORD }),
    { model: null, provider: 'codex' },
  );
});

test('tier outside the three names or effort max → role-config-invalid', () => {
  for (const role of [{ tier: 'high' }, { effort: 'max' }]) {
    const repo = roleRepo(claudeConfig({ roles: { [REVIEWER]: role }, model_tiers: TIER_CLAUDE }));
    const r = resolveSubagentRole({ repoRoot: repo, agentName: REVIEWER });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'role-config-invalid');
  }
});

test('mapped value inherit → ok with null model and source tier', () => {
  const repo = roleRepo(claudeConfig({
    roles: { [COORD]: { tier: 'standard' } },
    model_tiers: { claude: { standard: 'inherit' } },
  }));
  const r = resolveSubagentRole({ repoRoot: repo, agentName: COORD });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.model, null);
  assert.strictEqual(r.source, 'tier');
});

test('mapped value empty or non-string or mapping absent → tier-unmapped', () => {
  const mappings = [
    { claude: { standard: '' } },
    { claude: { standard: 5 } },
    undefined,
    {},
    'x',
    { claude: [] },
  ];
  for (const model_tiers of mappings) {
    const cfg = claudeConfig({ roles: { [COORD]: { tier: 'standard' } } });
    if (model_tiers !== undefined) cfg.model_tiers = model_tiers;
    const r = resolveSubagentRole({ repoRoot: roleRepo(cfg), agentName: COORD });
    assert.strictEqual(r.ok, false, JSON.stringify(model_tiers));
    assert.strictEqual(r.code, 'tier-unmapped', JSON.stringify(model_tiers));
  }
});

test('roles or the role entry has the wrong shape → role-config-invalid', () => {
  const shapes = [
    { roles: [] },
    { roles: null },
    { roles: { [REVIEWER]: 'x' } },
    { roles: { [REVIEWER]: null } },
    { roles: { [REVIEWER]: [] } },
  ];
  for (const shape of shapes) {
    const r = resolveSubagentRole({
      repoRoot: roleRepo(claudeConfig(shape)), agentName: REVIEWER,
    });
    assert.strictEqual(r.ok, false, JSON.stringify(shape));
    assert.strictEqual(r.code, 'role-config-invalid', JSON.stringify(shape));
  }
});

test('slot slug wins but effort is invalid → role-config-invalid', () => {
  const cfg = claudeConfig({ roles: { [REVIEWER]: { effort: 'max' } } });
  cfg.subagents.claude[REVIEWER] = 'claude-opus-5-5';
  const r = resolveSubagentRole({ repoRoot: roleRepo(cfg), agentName: REVIEWER });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'role-config-invalid');
});

test('effort only without tier → inherit source with the effort', () => {
  const repo = roleRepo(claudeConfig({ roles: { [REVIEWER]: { effort: 'low' } } }));
  assert.deepStrictEqual(
    resolveSubagentRole({ repoRoot: repo, agentName: REVIEWER }),
    {
      ok: true, provider: 'claude', role: REVIEWER, tier: null,
      model: null, effort: 'low', source: 'inherit',
    },
  );
  const nullEffort = roleRepo(claudeConfig({
    roles: { [COORD]: { tier: 'standard', effort: null } }, model_tiers: TIER_CLAUDE,
  }));
  assert.strictEqual(resolveSubagentRole({ repoRoot: nullEffort, agentName: COORD }).effort, null);
});

test('provider undeterminable with tier and effort → inherit carrying effort', () => {
  const saved = {};
  const keys = ['CLAUDE_PLUGIN_ROOT', 'PLUGIN_ROOT', 'CLAUDECODE', 'CODEX_THREAD_ID'];
  for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }
  try {
    const repo = roleRepo({
      roles: { [COORD]: { tier: 'standard', effort: 'high' } }, model_tiers: TIER_CLAUDE,
    });
    assert.deepStrictEqual(
      resolveSubagentRole({ repoRoot: repo, agentName: COORD }),
      {
        ok: true, provider: null, role: COORD, tier: 'standard',
        model: null, effort: 'high', source: 'inherit',
      },
    );
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
});

test('tier null with effort → ok with null tier; null or array role entry → invalid', () => {
  const repo = roleRepo(claudeConfig({ roles: { [REVIEWER]: { tier: null, effort: 'low' } } }));
  const r = resolveSubagentRole({ repoRoot: repo, agentName: REVIEWER });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.tier, null);
  assert.strictEqual(r.effort, 'low');
});

test('tier of wrong type or with control characters → invalid with <invalid> tier', () => {
  for (const tier of [7, 'a\nb']) {
    const repo = roleRepo(claudeConfig({ roles: { [REVIEWER]: { tier } } }));
    const r = resolveSubagentRole({ repoRoot: repo, agentName: REVIEWER });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, 'role-config-invalid');
    assert.strictEqual(r.tier, '<invalid>');
  }
});

// ---- 호출 단위 tier 인자 ----

function callTierConfig(extra) {
  return claudeConfig({
    subagents: { provider: 'claude', claude: { [REVIEWER]: 'slot-model' } },
    model_tiers: { claude: { strong: 'strong-model', standard: 'inherit' } },
    ...extra,
  });
}

test('call tier given with a slot slug → tier mapping wins over the slot', () => {
  const repo = roleRepo(callTierConfig());
  const r = resolveSubagentRole({ repoRoot: repo, agentName: REVIEWER, provider: 'claude', tier: 'strong' });
  assert.deepStrictEqual([r.ok, r.model, r.source, r.tier], [true, 'strong-model', 'tier', 'strong']);
  const noTier = resolveSubagentRole({ repoRoot: repo, agentName: REVIEWER, provider: 'claude' });
  assert.deepStrictEqual([noTier.ok, noTier.model, noTier.source, noTier.tier], [true, 'slot-model', 'slot', null]);
});

test('call tier without a mapping → tier-unmapped naming the config key', () => {
  const repo = roleRepo(callTierConfig());
  const r = resolveSubagentRole({ repoRoot: repo, agentName: REVIEWER, provider: 'claude', tier: 'light' });
  assert.deepStrictEqual(
    [r.ok, r.code, r.next],
    [false, 'tier-unmapped', 'model_tiers.claude.light'],
  );
});

test('call tier outside the three names → role-config-invalid pointing at tier', () => {
  const repo = roleRepo(callTierConfig());
  const r = resolveSubagentRole({ repoRoot: repo, agentName: REVIEWER, provider: 'claude', tier: 'bogus' });
  assert.deepStrictEqual([r.ok, r.code, r.next], [false, 'role-config-invalid', 'tier']);
});

test('call tier mapped to inherit → null model with source tier', () => {
  const repo = roleRepo(callTierConfig());
  const r = resolveSubagentRole({ repoRoot: repo, agentName: REVIEWER, provider: 'claude', tier: 'standard' });
  assert.deepStrictEqual([r.ok, r.model, r.source], [true, null, 'tier']);
});

test('call tier with roles effort → effort is kept', () => {
  const repo = roleRepo(callTierConfig({ roles: { [REVIEWER]: { effort: 'high' } } }));
  const r = resolveSubagentRole({ repoRoot: repo, agentName: REVIEWER, provider: 'claude', tier: 'strong' });
  assert.deepStrictEqual([r.ok, r.effort], [true, 'high']);
});

test('call tier with unknown provider → source inherit', () => {
  const repo = roleRepo({ model_tiers: { claude: { strong: 'strong-model' } } });
  const keys = ['CLAUDE_PLUGIN_ROOT', 'PLUGIN_ROOT', 'CLAUDECODE', 'CODEX_THREAD_ID'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  try {
    const r = resolveSubagentRole({ repoRoot: repo, agentName: REVIEWER, tier: 'strong' });
    assert.deepStrictEqual([r.ok, r.model, r.source], [true, null, 'inherit']);
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
});

test('call tier on model and dispatch resolvers → same model, no extra keys', () => {
  const repo = roleRepo(callTierConfig());
  const args = { repoRoot: repo, agentName: REVIEWER, provider: 'claude', tier: 'strong' };
  assert.deepStrictEqual(resolveSubagentModel(args), { model: 'strong-model', provider: 'claude' });
  assert.deepStrictEqual(
    resolveSubagentDispatch(args),
    { agent: REVIEWER, provider: 'claude', model: 'strong-model' },
  );
});
