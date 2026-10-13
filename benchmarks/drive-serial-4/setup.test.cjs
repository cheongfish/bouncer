'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { setupDriveSerial4 } = require('./setup.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SETUP_CLI = path.join(__dirname, 'setup.cjs');
const BOUNCER_BIN = path.join(REPO_ROOT, 'scripts', 'bouncer');

function tempDir() {
  return mkdtempSync(path.join(tmpdir(), 'drive-serial-4-'));
}

function runPreflight(cwd, blueprintDir) {
  const result = spawnSync(
    process.execPath,
    [BOUNCER_BIN, 'run', 'preflight', '--blueprint', blueprintDir],
    // 호출자 환경의 BOUNCER_HOME이 다른 설치본을 가리켜도 이 저장소 CLI를 검증한다.
    { cwd, encoding: 'utf8', env: { ...process.env, BOUNCER_HOME: REPO_ROOT } },
  );
  return JSON.parse(result.stdout);
}

for (const mode of ['baseline', 'auto', 'direct']) {
  test(`${mode} 모드로 생성 → preflight가 직렬 4-task를 위임 가능으로 내고 direct_eligible은 direct에서만 true다`, () => {
    const dir = tempDir();
    try {
      const { blueprintDir } = setupDriveSerial4(dir, { mode });
      const payload = runPreflight(dir, blueprintDir);
      assert.equal(payload.delegable, true);
      assert.equal(payload.shape.drive_shape, 'serial');
      assert.equal(payload.shape.commit_tasks, 4);
      assert.equal(payload.direct_eligible, mode === 'direct');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('잘못된 입력 → 함수가 아무것도 쓰기 전에 invalid-target 또는 invalid-mode를 던진다', () => {
  const root = tempDir();
  try {
    const missing = path.join(root, 'missing');
    assert.throws(() => setupDriveSerial4(missing, { mode: 'auto' }), { code: 'invalid-target' });
    assert.equal(existsSync(missing), false);

    const full = path.join(root, 'full');
    mkdirSync(full);
    writeFileSync(path.join(full, 'keep.txt'), 'x');
    assert.throws(() => setupDriveSerial4(full, { mode: 'auto' }), { code: 'invalid-target' });
    assert.deepEqual(readdirSync(full), ['keep.txt']);

    const empty = path.join(root, 'empty');
    mkdirSync(empty);
    assert.throws(() => setupDriveSerial4(empty, { mode: 'fast' }), { code: 'invalid-mode' });
    assert.deepEqual(readdirSync(empty), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('잘못된 입력 → CLI가 exit 2와 stderr 사유로 끝나고 대상에 새 파일을 만들지 않는다', () => {
  const root = tempDir();
  try {
    const full = path.join(root, 'full');
    mkdirSync(full);
    writeFileSync(path.join(full, 'keep.txt'), 'x');
    const empty = path.join(root, 'empty');
    mkdirSync(empty);
    const cases = [
      [path.join(root, 'missing'), 'auto'],
      [full, 'auto'],
      [empty, 'fast'],
    ];
    for (const [target, mode] of cases) {
      const result = spawnSync(process.execPath, [SETUP_CLI, target, '--mode', mode], { encoding: 'utf8' });
      assert.equal(result.status, 2, `${target} ${mode}: ${result.stderr}`);
      assert.notEqual(result.stderr.trim(), '');
    }
    assert.equal(existsSync(path.join(root, 'missing')), false);
    assert.deepEqual(readdirSync(full), ['keep.txt']);
    assert.deepEqual(readdirSync(empty), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('유효한 입력 → CLI가 blueprintDir를 JSON 한 줄로 stdout에 쓰고 exit 0이다', () => {
  const dir = tempDir();
  try {
    const result = spawnSync(process.execPath, [SETUP_CLI, dir, '--mode', 'auto'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      JSON.parse(result.stdout.trim()).blueprintDir,
      '.bouncer/context/epics/001-drive-serial/blueprints/001-serial-four',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
