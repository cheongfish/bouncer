'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const checker = path.join(root, 'scripts', 'check-distribution.js');
const NAMED_AGENTS = ['reviewer', 'implementer', 'debugger', 'context-reviewer', 'coordinator'];
// 고유 marker: 미커밋 수정이 builder tree -> asset-home -> 생성 TOML까지 전달됐는지 가르는 입력이다.
const MARKER = 'SMOKE-MARKER-4f7a1c9e';

test('clean snapshot runtime tgz → installs locally and globally with working CLI shims', () => {
  const result = spawnSync(process.execPath, [checker, '--smoke'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout.trim());
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.mode, 'smoke');
  assert.ok(report.pluginFiles.length > 0);
  assert.ok(report.runtimeFiles.includes('bin/bouncer'));
  // 보고서 확장: builder tree 목록과 설치별 관찰 결과가 실제 값으로 실린다.
  assert.ok(report.smoke.pluginFiles.includes('agents/bouncer-coordinator.md'));
  assert.deepStrictEqual(report.smoke.installs.map((install) => install.kind), ['local', 'global']);
});

/**
 * 실제 저장소의 tracked 파일을 임시 Git 저장소로 복제해 한 번 커밋한다.
 * 호출자가 커밋 이후 미커밋 수정을 얹어 snapshot 입력이 HEAD가 아닌 worktree 바이트임을 가른다.
 *
 * @returns {string} 임시 fixture 저장소 루트
 */
function makeFixtureCheckout() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-smoke-fixture-'));
  const listing = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.strictEqual(listing.status, 0, listing.stderr);
  const files = new Set(listing.stdout.split('\0').filter(Boolean));
  // 검사기와 이 테스트는 아직 미추적일 수 있어 snapshot과 같은 방식으로 실제 바이트를 포함한다.
  for (const rel of ['scripts/check-distribution.js', 'test/runtime-install-smoke.test.js']) files.add(rel);
  for (const rel of files) {
    const source = path.join(root, rel);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
    fs.mkdirSync(path.dirname(path.join(fixture, rel)), { recursive: true });
    fs.copyFileSync(source, path.join(fixture, rel));
  }
  const git = (...args) => {
    const result = spawnSync('git', ['-c', 'user.name=smoke', '-c', 'user.email=smoke@example.invalid',
      '-c', 'commit.gpgsign=false', ...args], { cwd: fixture, encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr);
  };
  git('init', '--quiet');
  git('add', '-A');
  git('commit', '--quiet', '--no-verify', '-m', 'fixture');
  return fixture;
}

test('uncommitted agent marker in fixture checkout → reaches every seeded TOML in local and global installs',
  { timeout: 20 * 60 * 1000 }, () => {
    const fixture = makeFixtureCheckout();
    try {
      const agentDoc = path.join(fixture, 'agents', 'bouncer-coordinator.md');
      fs.appendFileSync(agentDoc, `\n${MARKER}\n`);
      const { smoke } = require(checker);
      assert.strictEqual(typeof smoke, 'function', 'check-distribution must export smoke');

      const result = smoke({ root: fixture });

      assert.ok(result.pluginFiles.includes('agents/bouncer-coordinator.md'));
      assert.ok(!result.pluginFiles.some((file) => file.startsWith('packages/cli/')));
      assert.deepStrictEqual(result.installs.map((install) => install.kind), ['local', 'global']);
      for (const install of result.installs) {
        // plugin 없는 조회는 자산 부재를 정상 상태로 보고 current=null 이어야 한다.
        assert.strictEqual(install.current.ok, true, install.kind);
        assert.strictEqual(install.current.current, null, install.kind);
        const rels = NAMED_AGENTS.map((name) => `.codex/agents/bouncer-${name}.toml`);
        assert.deepStrictEqual(Object.keys(install.seededAgents).sort(), rels.sort(), install.kind);
        for (const [rel, body] of Object.entries(install.seededAgents)) {
          assert.ok(body.startsWith('# bouncer-generated'), `${install.kind} ${rel} generated marker`);
          assert.ok(body.trim().length > 40, `${install.kind} ${rel} non-empty`);
        }
        const coordinator = install.seededAgents['.codex/agents/bouncer-coordinator.toml'];
        assert.ok(coordinator.includes(MARKER), `${install.kind} coordinator carries uncommitted marker`);
        // 변경된 coordinator 계약(보고 기반 blocked, empty-commit 정지)이 양쪽 설치의 생성 역할까지 닿아야 한다.
        for (const code of ['unchanged-worker-report', 'empty-commit']) {
          assert.ok(coordinator.includes(code), `${install.kind} coordinator carries ${code}`);
        }
      }
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });
