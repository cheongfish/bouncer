#!/usr/bin/env node
'use strict';

// 테스트 계층 실행기: test/tiers.json의 목록을 읽어 해당 계층 파일만
// `node --test`로 실행한다. 계층 배정의 정본은 tiers.json 한 곳뿐이며
// npm 스크립트에는 파일 목록을 쓰지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TIERS = ['unit', 'integration'];
const GUARD = path.resolve(__dirname, '..', 'test', 'helpers', 'no-spawn.js');

/**
 * unit 계층 실행에 쓸 NODE_OPTIONS 값을 만든다.
 * 기존 NODE_OPTIONS는 보존하고 guard `--require`를 뒤에 더한다.
 * 경로에 공백이 있을 수 있어 항상 큰따옴표로 감싼다.
 *
 * @returns {string} guard를 로드하는 NODE_OPTIONS 문자열
 */
function unitNodeOptions() {
  const req = `--require ${JSON.stringify(GUARD)}`;
  return process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ${req}` : req;
}

/**
 * 계층 하나를 실행한다. 알 수 없는 계층과 없는 파일은 `node --test`를
 * 부르기 전에 거부한다(각각 종료 코드 2, 1).
 *
 * @param {string | undefined} tier - `unit` 또는 `integration`
 * @returns {number} 프로세스 종료 코드(`node --test`의 코드를 그대로 전달)
 */
function run(tier) {
  if (!TIERS.includes(tier)) {
    process.stderr.write('usage: node scripts/test-tier.js <unit|integration>\n');
    return 2;
  }
  // 목록은 cwd 기준으로 읽는다: 검사 테스트가 임시 디렉터리로 거부 경로를 재현한다.
  const tiersPath = path.join(process.cwd(), 'test', 'tiers.json');
  const files = JSON.parse(fs.readFileSync(tiersPath, 'utf8'))[tier] || [];
  const missing = files.filter((f) => !fs.existsSync(path.join(process.cwd(), 'test', f)));
  if (missing.length > 0) {
    process.stderr.write(`tier "${tier}" lists missing test files: ${missing.join(', ')}\n`);
    return 1;
  }
  const env = { ...process.env };
  if (tier === 'unit') env.NODE_OPTIONS = unitNodeOptions();
  const res = spawnSync(
    process.execPath,
    ['--test', ...files.map((f) => path.join('test', f))],
    { env, stdio: 'inherit' },
  );
  if (res.error) throw res.error;
  // 시그널 종료는 status가 null이므로 실패(1)로 취급한다.
  return res.status === null ? 1 : res.status;
}

module.exports = { unitNodeOptions, run };

if (require.main === module) {
  // 인자 없는 `node --test`(npm test, test:coverage)의 기본 glob이 `test-*.js`인
  // 이 파일을 테스트로 집어 실행한다. 러너가 심은 NODE_TEST_CONTEXT가 있으면
  // 사용법 오류(2)로 전체 스위트를 깨뜨리지 않도록 아무것도 하지 않고 끝낸다.
  if (!process.env.NODE_TEST_CONTEXT) process.exitCode = run(process.argv[2]);
}
