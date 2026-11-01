// test/init-seed-recovery.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { init } = require('../packages/cli/dist/init');

const TIMESTAMP = '2026-11-01T00:00:00.000Z';
const REVIEWER = '.codex/agents/bouncer-reviewer.toml';
const DEBUGGER = '.codex/agents/bouncer-debugger.toml';
const STALE = '# bouncer-generated\nstale = true\n';

// 실제 init으로 신규 저장소를 한 번 부트스트랩해 "이미 초기화된 저장소"를 만든다.
// 재시드는 그 뒤의 두 번째 init 호출에서만 일어나므로 이 fixture가 기준선이다.
function initializedRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-seed-recovery-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: repo, stdio: 'ignore' });
  const first = init({ repoRoot: repo, timestamp: TIMESTAMP, seedCodexAgents: true });
  assert.strictEqual(first.ok, true, 'fixture bootstrap must succeed');
  return repo;
}

// 재시드 결과의 배열은 항상 저장소 상대 posix 경로로 정렬해 비교한다.
function sorted(list) {
  return [...list].sort();
}

test('stale generated TOML in an initialized repo → reseed reports updated, not already-initialized', () => {
  const repo = initializedRepo();
  try {
    fs.writeFileSync(path.join(repo, REVIEWER), STALE);
    const result = init({ repoRoot: repo, timestamp: TIMESTAMP, seedCodexAgents: true });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.skipped, false);
    assert.strictEqual(result.reason, 'codex-agents-updated');
    assert.deepStrictEqual(result.updated, [REVIEWER]);
    assert.deepStrictEqual(result.created, []);
    // 실제로 갱신된 파일은 stale 내용을 벗어나 생성본 마커로 돌아와야 한다.
    assert.notStrictEqual(fs.readFileSync(path.join(repo, REVIEWER), 'utf8'), STALE);
    assert.strictEqual(fs.readFileSync(path.join(repo, REVIEWER), 'utf8').split('\n')[0], '# bouncer-generated');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('deleted generated TOML in an initialized repo → reseed reports created only with codex-agents-seeded', () => {
  const repo = initializedRepo();
  try {
    fs.rmSync(path.join(repo, DEBUGGER));
    const result = init({ repoRoot: repo, timestamp: TIMESTAMP, seedCodexAgents: true });
    assert.strictEqual(result.skipped, false);
    assert.strictEqual(result.reason, 'codex-agents-seeded');
    assert.deepStrictEqual(result.created, [DEBUGGER]);
    assert.deepStrictEqual(result.updated, []);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('deleted and stale generated TOML in one reseed → fills both arrays with codex-agents-seeded', () => {
  const repo = initializedRepo();
  try {
    fs.rmSync(path.join(repo, DEBUGGER));
    fs.writeFileSync(path.join(repo, REVIEWER), STALE);
    const result = init({ repoRoot: repo, timestamp: TIMESTAMP, seedCodexAgents: true });
    assert.strictEqual(result.skipped, false);
    assert.strictEqual(result.reason, 'codex-agents-seeded');
    assert.deepStrictEqual(result.created, [DEBUGGER]);
    assert.deepStrictEqual(sorted(result.updated), [REVIEWER]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('reseed of an already synchronized repo → skipped with already-initialized and both arrays empty', () => {
  const repo = initializedRepo();
  try {
    const result = init({ repoRoot: repo, timestamp: TIMESTAMP, seedCodexAgents: true });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.reason, 'already-initialized');
    assert.deepStrictEqual(result.created, []);
    assert.deepStrictEqual(result.updated, []);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('stale user-owned TOML without the generated marker → reseed leaves it and reports already-initialized', () => {
  const repo = initializedRepo();
  try {
    const owned = 'name = "mine"\n';
    fs.writeFileSync(path.join(repo, REVIEWER), owned);
    const result = init({ repoRoot: repo, timestamp: TIMESTAMP, seedCodexAgents: true });
    // 사용자 소유 파일은 생성 대상이 아니므로 갱신 배열에 넣으면 거짓 보고가 된다.
    assert.strictEqual(fs.readFileSync(path.join(repo, REVIEWER), 'utf8'), owned);
    assert.strictEqual(result.reason, 'already-initialized');
    assert.deepStrictEqual(result.updated, []);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
