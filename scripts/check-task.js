#!/usr/bin/env node
'use strict';

// task 전용 검증 래퍼: `bouncer.verify`는 단일 argv라 `&&`로 여러 검사를 묶을 수 없다.
// 이 래퍼가 종단 `npm run ci`의 테스트 관련 정적 검사(이름 lint, tier 등록, 문서 인용)와
// 넘긴 테스트 파일의 tier별 실행을 한 번에 수행해, task 단계에서 CI 실패를 미리 잡는다.
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');
const checkTestNames = require('./check-test-names');
const { unitNodeOptions } = require('./test-tier');

const TEST_FILE = /^test\/[^/]+\.test\.js$/;
// 저장소 전체를 보는 고정 검사. tier 배정과 plugin 문서 인용은 파일 하나만 바꿔도 깨질 수 있다.
const FIXED_CHECKS = ['test/test-tiers.test.js', 'test/plugin-doc-cites.test.js'];

/**
 * 인자 경로를 cwd 상대 posix 경로로 정규화한다(`./`와 백슬래시 흡수).
 *
 * @param {string} arg - 사용자가 넘긴 경로
 * @returns {string} 정규화한 상대 경로
 */
function normalize(arg) {
  return path.posix.normalize(arg.split('\\').join('/'));
}

/**
 * spawn 결과가 성공인지 판정한다. 시그널 종료(status null)와 spawn error도 실패다.
 *
 * @param {{status: number | null, error?: Error}} res - spawnSync 반환값
 * @returns {boolean} 성공이면 true
 */
function succeeded(res) {
  return !res.error && res.status === 0;
}

/**
 * 사전 검사: 형식 → 존재 → tiers.json 읽기. 하나라도 걸리면 호출자가 즉시 종료한다.
 *
 * @param {string[]} files - 정규화한 경로 목록
 * @param {{err: {write: function(string): void}, cwd: string}} io - 출력 seam과 기준 디렉터리
 * @returns {{unit: string[], integration: string[]} | null} 읽은 tier 목록, 사전 검사 실패면 null
 */
function preflight(files, io) {
  const badFormat = files.find((f) => !TEST_FILE.test(f));
  if (badFormat) {
    io.err.write(`not a test file: ${badFormat}\n`);
    return null;
  }
  for (const f of files) {
    let isFile = false;
    try {
      isFile = fs.statSync(path.join(io.cwd, f)).isFile();
    } catch (e) {
      // ENOENT만 "없는 파일"로 흡수한다. 권한 오류 등은 다른 원인이므로 그대로 던진다.
      if (e.code !== 'ENOENT') throw e;
    }
    if (!isFile) {
      io.err.write(`missing test file: ${f}\n`);
      return null;
    }
  }
  try {
    return JSON.parse(fs.readFileSync(path.join(io.cwd, 'test', 'tiers.json'), 'utf8'));
  } catch (e) {
    // 읽기 실패(ENOENT 등)와 JSON 파싱 실패만 같은 안내로 묶는다: 둘 다 "목록을 못 읽음"이다.
    if (e.code !== undefined && e.code !== 'ENOENT' && e.code !== 'EISDIR') throw e;
    io.err.write(`cannot read test/tiers.json: ${e.message}\n`);
    return null;
  }
}

/**
 * 넘긴 테스트 파일에 task 단계 검사를 실행한다. 단계 실패는 남은 단계를 끝까지 돌린 뒤 1로 끝낸다.
 *
 * @param {string[]} argv - 테스트 파일 경로(cwd 상대)
 * @param {{out: {write: function(string): void}, err: {write: function(string): void}, cwd: string}} io
 *   출력 seam과 저장소 루트
 * @param {{spawnSync: function}} [deps] - 테스트가 호출 인자·env를 관찰하는 spawn seam
 * @returns {number} 0 성공, 1 검사 실패, 2 인자 없음
 */
function main(argv, io, deps = { spawnSync: childProcess.spawnSync }) {
  if (argv.length === 0) {
    io.err.write('usage: node scripts/check-task.js <test/<name>.test.js>...\n');
    return 2;
  }
  // 1. 사전 검사
  const files = argv.map(normalize);
  const tiers = preflight(files, io);
  if (tiers === null) return 1;

  let failed = false;
  const step = (label, state) => {
    io.out.write(`${label}: ${state}\n`);
    if (state === 'fail') failed = true;
  };
  // 중첩 `node --test`가 부모의 NODE_TEST_CONTEXT를 물려받으면 파일을 건너뛰고 exit 0이 되므로 지운다.
  const spawn = (args, nodeOptions) => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    if (nodeOptions !== undefined) env.NODE_OPTIONS = nodeOptions;
    return succeeded(deps.spawnSync(process.execPath, ['--test', ...args], { cwd: io.cwd, env, stdio: 'inherit' }));
  };

  // 2. 이름 lint: 같은 프로세스에서 호출하고 요약 줄은 이 래퍼가 쓰므로 lint 자체의 out은 버린다.
  const lintCode = checkTestNames.main(files, {
    out: () => {},
    err: (s) => io.err.write(s),
    cwd: io.cwd,
  });
  step('names', lintCode === 0 ? 'ok' : 'fail');

  // 3. tier 등록 확인: 미등록·이중 등록 파일은 어느 tier에서도 실행하지 않는다.
  const unit = [];
  const integration = [];
  let tierOk = true;
  for (const f of files) {
    const base = path.posix.basename(f);
    const inUnit = (tiers.unit || []).includes(base);
    const inInt = (tiers.integration || []).includes(base);
    if (inUnit && inInt) {
      io.err.write(`in both tiers of test/tiers.json: ${f}\n`);
      tierOk = false;
    } else if (!inUnit && !inInt) {
      io.err.write(`not in test/tiers.json: ${f}\n`);
      tierOk = false;
    } else {
      (inUnit ? unit : integration).push(f);
    }
  }
  step('tiers', tierOk ? 'ok' : 'fail');

  // 4. 고정 검사(guard 없음: test-tiers.test.js가 프로세스를 띄운다)
  step('fixed checks', spawn(FIXED_CHECKS) ? 'ok' : 'fail');
  // 5. unit 파일은 no-spawn guard 아래에서 실행해 tier 규칙을 그대로 강제한다.
  step('unit', unit.length === 0 ? 'skip' : (spawn(unit, unitNodeOptions()) ? 'ok' : 'fail'));
  // 6. integration 파일(guard 없음)
  step('integration', integration.length === 0 ? 'skip' : (spawn(integration) ? 'ok' : 'fail'));
  return failed ? 1 : 0;
}

module.exports = { main };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2), { out: process.stdout, err: process.stderr, cwd: process.cwd() });
}
