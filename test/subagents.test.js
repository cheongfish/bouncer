'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveSubagentModel } = require('../scripts/lib/subagents');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-subagents-'));
}

function writeConfig(repo, config) {
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify(config));
}

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

test('provider argument wins over config.subagents.provider', () => {
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

test('config.subagents.provider is used when argument is omitted', () => {
  const repo = tmpRepo();
  writeConfig(repo, SAMPLE);
  assert.deepStrictEqual(
    resolveSubagentModel({ repoRoot: repo, agentName: 'bouncer-reviewer' }),
    { model: 'claude-opus-4-6', provider: 'claude' },
  );
});

test('CLAUDE_PLUGIN_ROOT implies claude when config has no provider', () => {
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

test('PLUGIN_ROOT alone implies codex when config has no provider', () => {
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

test('no provider signal yields null model and null provider', () => {
  const repo = tmpRepo();
  writeConfig(repo, {
    subagents: {
      cursor: { 'bouncer-reviewer': 'composer-2.5-fast' },
    },
  });
  const prevClaude = process.env.CLAUDE_PLUGIN_ROOT;
  const prevPlugin = process.env.PLUGIN_ROOT;
  const prevHome = process.env.BOUNCER_HOME;
  try {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    delete process.env.PLUGIN_ROOT;
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
  }
});

test('config.subagents.provider antigravity resolves the antigravity block', () => {
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
test('BOUNCER_HOME alone never resolves provider antigravity', () => {
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
  const prevClaude = process.env.CLAUDE_PLUGIN_ROOT;
  const prevPlugin = process.env.PLUGIN_ROOT;
  const prevHome = process.env.BOUNCER_HOME;
  try {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    delete process.env.PLUGIN_ROOT;
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
  }
});

test('inherit and non-string values return null model with resolved provider', () => {
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

test('missing agent key returns null model with resolved provider', () => {
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

test('resolveSubagentModel returns provider values for bouncer-debugger', () => {
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

test('resolveSubagentModel returns provider values for bouncer-context-reviewer', () => {
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

test('resolveSubagentModel miss for bouncer-debugger yields null model', () => {
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

test('missing config / broken JSON / missing subagents do not throw', () => {
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
test('resolveSubagentModel returns provider values for bouncer-coordinator', () => {
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

test('resolveSubagentModel miss for bouncer-coordinator yields null model', () => {
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

// 슬러그 거절 재시도와 named-agent 부재 fallback 모두 같은 coordinator 역할을
// 넘겨야 한다. 계약이 model 규칙에만 있고 fallback brief를 줄이면, 위임받은
// 쪽이 worktree guard 없이 drive를 시작한다.
test('coordinator dispatch shares the model contract and keeps its full fallback brief', () => {
  const contract = fs.readFileSync(
    path.join(__dirname, '..', 'rules/subagent-model.md'), 'utf8',
  );
  assert.match(contract, /bouncer-coordinator/);
  assert.match(contract, /rejected model slug[\s\S]{0,120}`inherit`/i);
  assert.match(contract, /named agents are unavailable/i);
  const coordinatorClause = contract.match(/`\/bouncer-run` resolves[\s\S]*?(?=\n\n)/)?.[0] || '';
  assert.match(coordinatorClause, /whole coordinator role/i);
  assert.match(coordinatorClause, /worktree write boundary/i);
  assert.match(coordinatorClause, /never a shortened\s+brief/i);
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
    rel: 'skills/bouncer-execute/references/agent-dispatch.md',
    after: 'For review,',
    start: 'If named agents are unavailable',
    end: '\n\n',
    inline: true,
    inputs: REVIEWER_INPUTS,
  },
  {
    role: 'debugger',
    rel: 'skills/bouncer-execute/references/verification-recovery.md',
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
    rel: 'skills/bouncer-execute/references/agent-dispatch.md',
    start: 'If the TOML is missing',
    end: '\n\n',
    inline: true,
    inputs: [
      'Goal & intent', 'Current behavior', 'Target behavior', 'Interface',
      'Touch', 'Do not touch', 'Constraints', 'Checklist', 'actual worktree cwd',
    ],
  },
  {
    role: 'coordinator',
    rel: 'rules/subagent-model.md',
    start: '5. `/bouncer-run` resolves',
    end: '\n\n',
    inline: false,
    // payload 정의의 정본은 run step 4다. rule 5는 그것을 가리키기만 한다.
    inputs: ['`/bouncer-run` dispatch payload', '`skills/bouncer-run/SKILL.md` step 4'],
    copies: ['closing action', 'start selection', 'autonomy', 'base SHA'],
  },
];

for (const site of FALLBACK_SITES) {
  test(`${site.role} fallback in ${site.rel} carries the whole role document and its controller input`, () => {
    const text = passage(site.rel, site.start, site.end, site.after);
    assert.match(text, wrapped(`entire body of \`agents/bouncer-${site.role}.md\``));
    assert.match(text, /Authority\s+through\s+Output\s+contract/);
    for (const input of site.inputs) {
      assert.match(text, wrapped(input), `${site.rel}: missing controller input ${input}`);
    }
    if (site.inline) {
      assert.match(text, wrapped(`first reads \`agents/bouncer-${site.role}.md\``));
    }
    for (const field of site.copies || []) {
      assert.doesNotMatch(text, wrapped(field), `${site.rel}: copies owner field ${field}`);
    }
    // 이전 요약 표현이 payload 정의로 돌아오면 역할 문서가 빠져도 통과한다.
    assert.doesNotMatch(text, /same (?:brief|prompt)\b/i);
  });
}

test('rule 4 defines the same role brief as the whole role document plus controller input', () => {
  const rule = passage('rules/subagent-model.md', '4. When named agents are unavailable', '\n5. ');
  assert.match(rule, wrapped('same role brief'));
  assert.match(rule, wrapped('entire body of the role document `agents/bouncer-<role>.md`'));
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
