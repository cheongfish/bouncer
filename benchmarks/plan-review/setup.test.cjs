'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { setupPlanReview } = require('./setup.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SETUP_CLI = path.join(__dirname, 'setup.cjs');
const BOUNCER_BIN = path.join(REPO_ROOT, 'packages', 'cli', 'bin', 'bouncer');

function tempDir() {
  return mkdtempSync(path.join(tmpdir(), 'plan-review-'));
}

// 호출자 환경의 BOUNCER_HOME이 다른 설치본을 가리켜도 이 저장소 CLI를 검증한다.
function bouncer(cwd, args) {
  const result = spawnSync(process.execPath, [BOUNCER_BIN, ...args], {
    cwd, encoding: 'utf8', env: { ...process.env, BOUNCER_HOME: REPO_ROOT },
  });
  return JSON.parse(result.stdout);
}

test('plan-review fixture → both plans dispatch single and pass the plan gate with review-risk-missing', () => {
  const dir = tempDir();
  try {
    const { blueprints, defects } = setupPlanReview(dir);
    assert.deepEqual(defects, ['D1', 'D2', 'D3', 'D4', 'D5']);

    const small = bouncer(dir, ['review-dispatch', 'plan', '--blueprint', blueprints.small]);
    const large = bouncer(dir, ['review-dispatch', 'plan', '--blueprint', blueprints.large]);
    assert.equal(small.strategy, 'single');
    assert.equal(large.strategy, 'single');

    for (const blueprint of [blueprints.small, blueprints.large]) {
      const gate = bouncer(dir, ['validate', '--gate', 'plan', '--blueprint', blueprint]);
      // G18·G25는 doc-quality-gate-removal이 plan gate에서 지웠다. 의도하지 않은 결함이
      // 섞이지 않도록 실패 코드가 비어 있음을 정확히 고정한다(D5는 reviewer 측정 대상).
      assert.equal(gate.ok, true);
      assert.deepStrictEqual(gate.failures.map((f) => f.code), []);
      assert.ok(gate.warnings.some((w) => w.code === 'review-risk-missing'));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('비어 있지 않거나 없는 대상 → invalid-target을 던지고 파일을 쓰지 않는다', () => {
  const root = tempDir();
  try {
    const missing = path.join(root, 'missing');
    assert.throws(() => setupPlanReview(missing), { code: 'invalid-target' });
    assert.equal(existsSync(missing), false);

    const full = path.join(root, 'full');
    mkdirSync(full);
    writeFileSync(path.join(full, 'keep.txt'), 'x');
    assert.throws(() => setupPlanReview(full), { code: 'invalid-target' });
    assert.deepEqual(readdirSync(full), ['keep.txt']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI 비어 있지 않은 대상 → exit 2, 빈 대상 → exit 0과 JSON 한 줄', () => {
  const root = tempDir();
  try {
    const full = path.join(root, 'full');
    mkdirSync(full);
    writeFileSync(path.join(full, 'keep.txt'), 'x');
    assert.equal(spawnSync(process.execPath, [SETUP_CLI, full], { encoding: 'utf8' }).status, 2);

    const empty = path.join(root, 'empty');
    mkdirSync(empty);
    const ok = spawnSync(process.execPath, [SETUP_CLI, empty], { encoding: 'utf8' });
    assert.equal(ok.status, 0);
    assert.equal(JSON.parse(ok.stdout).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
