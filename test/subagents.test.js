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
    },
    cursor: {
      'bouncer-reviewer': 'composer-2.5-fast',
      'bouncer-implementer': 'inherit',
      'bouncer-debugger': 'inherit',
    },
    codex: {
      'bouncer-reviewer': 'gpt-5.3-codex',
      'bouncer-implementer': 42,
      'bouncer-debugger': 'gpt-5.3-codex',
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
