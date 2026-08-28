'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCli } = require('../scripts/lib/cli');
const { SUGGESTED_IGNORES } = require('../scripts/lib/init');

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

function parseOut(buf) {
  return JSON.parse(buf.out);
}

test('init rejects legacy .sdd/ state with exit 1 and /bouncer-init guidance', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-init-'));
  fs.mkdirSync(path.join(repo, '.sdd'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.sdd/current'), '{"blueprint":"legacy"}\n');
  const { io, buf } = capture();
  const code = runCli(['init', '--repo', repo], io);
  assert.strictEqual(code, 1);
  const combined = `${buf.out}\n${buf.err}`;
  assert.match(combined, /\/bouncer-init/);
});

test('cli init --no-graphify skips install and keeps enabled true without bin', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-init-'));
  const { io, buf } = capture();
  const code = runCli(['init', '--repo', repo, '--no-graphify'], io);
  assert.strictEqual(code, 0);
  const body = parseOut(buf);
  assert.strictEqual(body.graphifyInstall, undefined);
  const cfg = JSON.parse(fs.readFileSync(path.join(repo, '.bouncer/config.json'), 'utf8'));
  assert.deepStrictEqual(cfg.graphify, { enabled: true });
  assert.ok(!fs.existsSync(path.join(repo, '.codex')));
});

test('cli init --seed-codex-agents writes named-agent toml', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-init-'));
  const { io, buf } = capture();
  const code = runCli(['init', '--repo', repo, '--no-graphify', '--seed-codex-agents'], io);
  assert.strictEqual(code, 0);
  const body = parseOut(buf);
  assert.ok(body.created.some((p) => p.startsWith('.codex/')));
  assert.ok(fs.existsSync(path.join(repo, '.codex/agents/bouncer-reviewer.toml')));
});

test('cli init --write-gitignore writes the marker block', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-init-'));
  const { io, buf } = capture();
  // --no-graphify로 실제 pip을 피한다 — 플래그 배선만 검증.
  const code = runCli(['init', '--repo', repo, '--no-graphify', '--write-gitignore'], io);
  assert.strictEqual(code, 0);
  const body = parseOut(buf);
  assert.strictEqual(body.gitignoreWritten, true);
  const gi = fs.readFileSync(path.join(repo, '.gitignore'), 'utf8');
  const block = `# bouncer\n${SUGGESTED_IGNORES.join('\n')}\n# /bouncer`;
  assert.ok(gi.includes(block));
});

test('cli init JSON flags baseBranchUnresolved when detection fails', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-init-'));
  const { io, buf } = capture();
  const code = runCli(['init', '--repo', repo, '--no-graphify'], io);
  assert.strictEqual(code, 0);
  const body = parseOut(buf);
  assert.strictEqual(body.baseBranchUnresolved, true);
  const cfg = JSON.parse(fs.readFileSync(path.join(repo, '.bouncer/config.json'), 'utf8'));
  assert.ok(!Object.prototype.hasOwnProperty.call(cfg, 'base_branch'));
});

test('cli init --promote-graphify promotes enabled on a ready repo', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-init-'));
  // 먼저 부트스트랩(설치 없이), 그다음 enabled를 false로 내린 뒤 승격.
  runCli(['init', '--repo', repo, '--no-graphify'], capture().io);
  const cfgPath = path.join(repo, '.bouncer/config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  cfg.graphify = { enabled: false };
  fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);

  const { io, buf } = capture();
  const code = runCli(['init', '--repo', repo, '--no-graphify', '--promote-graphify'], io);
  assert.strictEqual(code, 0);
  const body = parseOut(buf);
  assert.strictEqual(body.graphifyPromotion, 'promoted');
  const next = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  assert.strictEqual(next.graphify.enabled, true);
});
