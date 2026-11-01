// test/test-tiers.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// test/tiers.json은 계층 배정의 정본이다. scripts/test-tier.js(unit/integration 실행)와
// scripts/check-task.js(등록 확인)가 이 목록을 그대로 읽으므로, 목록이 디스크와 어긋나면
// 어느 계층에서도 돌지 않는 테스트가 생긴다. 이 파일 자체가 unit 계층이라 프로세스를 띄우지
// 않고 JSON과 디스크 목록만 대조한다.
const TEST_DIR = __dirname;

function loadTiers() {
  return JSON.parse(fs.readFileSync(path.join(TEST_DIR, 'tiers.json'), 'utf8'));
}

// 계층 배정 대상은 test/ 바로 아래의 *.test.js 일반 파일이다. helpers/와 fixtures/는
// 디렉터리이거나 *.test.js가 아니므로 자연히 제외된다.
function testFilesOnDisk() {
  return fs.readdirSync(TEST_DIR)
    .filter((f) => f.endsWith('.test.js') && fs.statSync(path.join(TEST_DIR, f)).isFile());
}

test('tier manifest → lists every test/*.test.js file in exactly one tier', () => {
  const tiers = loadTiers();
  const entries = [...tiers.unit, ...tiers.integration];
  const problems = testFilesOnDisk().flatMap((f) => {
    const count = entries.filter((e) => e === f).length;
    return count === 1 ? [] : [`${f} listed ${count} times`];
  });
  assert.deepStrictEqual(problems, []);
});

test('tier manifest → names no test file that is missing on disk', () => {
  const tiers = loadTiers();
  const entries = [...tiers.unit, ...tiers.integration];
  const missing = entries.filter((e) => !fs.existsSync(path.join(TEST_DIR, e)));
  assert.deepStrictEqual(missing, []);
});

test('init-seed-recovery test → is registered in the integration tier, not unit', () => {
  // 이 파일은 git을 띄우므로 unit 계층에 있으면 guard가 실패시킨다.
  const tiers = loadTiers();
  assert.ok(tiers.integration.includes('init-seed-recovery.test.js'));
  assert.ok(!tiers.unit.includes('init-seed-recovery.test.js'));
});
