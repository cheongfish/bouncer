'use strict';

// 계층 분할(test/tiers.json)·spawn guard·실행기(scripts/test-tier.js)를 검증한다.
// 프로세스를 띄우므로 이 파일 자체는 integration 계층에 속한다.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(ROOT, 'scripts', 'test-tier.js');

// 실행기는 NODE_TEST_CONTEXT가 있으면(node --test 하위) 동작하지 않으므로 지워서 띄운다.
function cleanEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function loadTiers() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'tiers.json'), 'utf8'));
}

function listTestFiles() {
  return fs.readdirSync(path.join(ROOT, 'test')).filter((f) => f.endsWith('.test.js')).sort();
}

test('every test file → is assigned to a tier', () => {
  const { unit, integration } = loadTiers();
  const assigned = new Set([...unit, ...integration]);
  const missing = listTestFiles().filter((f) => !assigned.has(f));
  assert.deepStrictEqual(missing, []);
});

test('no test file → is in both tiers', () => {
  const { unit, integration } = loadTiers();
  const both = unit.filter((f) => integration.includes(f));
  assert.deepStrictEqual(both, []);
});

test('tier → lists name only existing files', () => {
  const { unit, integration } = loadTiers();
  const existing = new Set(listTestFiles());
  const ghost = [...unit, ...integration].filter((f) => !existing.has(f));
  assert.deepStrictEqual(ghost, []);
});

test('unit guard → rejects process spawning and lets pure tests pass', () => {
  const { unitNodeOptions } = require('../scripts/test-tier');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiers-guard-'));
  try {
    const spawning = path.join(dir, 'spawning.test.js');
    const pure = path.join(dir, 'pure.test.js');
    fs.writeFileSync(spawning, [
      "const test = require('node:test');",
      "const cp = require('node:child_process');",
      "test('spawns', () => { cp.spawnSync(process.execPath, ['-e', '0']); });",
      '',
    ].join('\n'));
    fs.writeFileSync(pure, [
      "const test = require('node:test');",
      "const assert = require('node:assert');",
      "test('pure', () => { assert.strictEqual(1 + 1, 2); });",
      '',
    ].join('\n'));
    // NODE_TEST_CONTEXT가 남아 있으면 중첩 러너가 파일 실행을 건너뛰고 0으로 끝난다.
    const env = { ...process.env, NODE_OPTIONS: unitNodeOptions() };
    delete env.NODE_TEST_CONTEXT;
    const bad = spawnSync(process.execPath, ['--test', spawning], { env, encoding: 'utf8' });
    assert.notStrictEqual(bad.status, 0);
    assert.match(bad.stdout + bad.stderr, /unit tier must not spawn processes: spawnSync/);
    const good = spawnSync(process.execPath, ['--test', pure], { env, encoding: 'utf8' });
    assert.strictEqual(good.status, 0, good.stdout + good.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runner → exits 2 with usage for an unknown tier', () => {
  const res = spawnSync(process.execPath, [RUNNER, 'bogus'], { env: cleanEnv(), encoding: 'utf8' });
  assert.strictEqual(res.status, 2);
  assert.match(res.stderr, /usage/i);
});

test('runner → exits 1 naming a listed file that does not exist, before node --test', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiers-run-'));
  try {
    fs.mkdirSync(path.join(dir, 'test'));
    fs.writeFileSync(
      path.join(dir, 'test', 'tiers.json'),
      JSON.stringify({ unit: ['ghost-file.test.js'], integration: [] }),
    );
    const res = spawnSync(process.execPath, [RUNNER, 'unit'], { cwd: dir, env: cleanEnv(), encoding: 'utf8' });
    assert.strictEqual(res.status, 1);
    assert.match(res.stderr, /ghost-file\.test\.js/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
