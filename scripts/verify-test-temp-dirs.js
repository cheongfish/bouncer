'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// TASKS-001(고정 가짜 저장소 경로 격리)의 task 검증 래퍼. 인자 없이 실행하며 두 테스트 파일만 본다.
// 두 파일은 gate 결과를 임시 디렉터리 fixture로 검사하므로, 이 래퍼는 그 테스트와 그 파일들이
// 통과하는지, 그리고 이름·정적 규칙이 깨지지 않았는지만 확인한다. 전체 CI(`npm run ci`)는
// 마지막 verification task가 한 번 돌리므로 여기서는 돌리지 않는다.
const TESTS = ['test/comprehension.test.js', 'test/validate-gates.test.js'];
const SELF = 'scripts/verify-test-temp-dirs.js';

const repoRoot = path.join(__dirname, '..');

/**
 * 한 단계를 argv 배열로 실행하고 실패하면 그 단계 이름과 함께 즉시 종료한다. 셸 문자열을 쓰지 않는
 * 이유는 경로 보간을 막기 위해서다(verify-model-tiers-followups와 같은 규칙). 출력은 그대로 상속해
 * 실패 지점이 호출자 로그에 남게 한다.
 *
 * @param {string} label - stderr에 남길 단계 이름
 * @param {string} command - 실행 파일(npm·npx·node)
 * @param {string[]} args - 인자
 * @returns {void} exit 0이면 반환한다. 아니면 stderr 한 줄 뒤 같은 코드(없으면 1)로 종료
 */
function step(label, command, args) {
  process.stdout.write(`\n== verify-test-temp-dirs: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-test-temp-dirs: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-test-temp-dirs: ${label} failed (exit ${result.status})\n`);
    process.exit(result.status == null ? 1 : result.status);
  }
}

// 인자를 받지 않는 래퍼다. 인자가 들어오면 범위를 잘못 고른 호출이므로 조용히 무시하지 않고 거부한다.
if (process.argv.length !== 2) {
  process.stderr.write(`usage: node ${SELF}\n`);
  process.exit(2);
}
const node = process.execPath;

// 1. 테스트는 packages/cli/dist를 읽으므로 빌드가 먼저다.
step('build', 'npm', ['run', 'build']);
// 2. 두 테스트 파일 자체.
step('tests', node, ['--test', ...TESTS]);
// 3. eslint: 두 테스트와 이 래퍼 자신.
step('lint', 'npx', ['eslint', ...TESTS, SELF]);
// 4. 테스트 이름 규칙(`<condition> → <result>`).
step('lint:test-names', node, ['scripts/check-test-names.js', ...TESTS]);
// 5. 생성물 parity 검사. 테스트 fixture 변경이 생성물 경로를 건드리지 않음을 확인하는 최종 관문이다.
step('check:emit', node, ['scripts/check-emit.js']);

process.stdout.write('\nverify-test-temp-dirs: ok\n');
