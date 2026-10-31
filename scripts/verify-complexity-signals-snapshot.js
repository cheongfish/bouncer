'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// 리뷰 snapshot의 file_lines 추가 task 검증 범위다. 전체 CI는 마지막 verification task가 한 번만 돌리므로
// 이 래퍼는 이 변경이 닿는 테스트와 정적 검사만 고른다. 순서는 빌드 → typecheck → 테스트 → 정적 검사 →
// 테스트 이름 규칙으로, 앞 단계가 뒤 단계의 입력을 만든다.
const TESTS = [
  'test/review-snapshot.test.js',
  'test/review-dispatch.test.js',
  'test/review-record.test.js',
];
const LINT_FILES = [
  'packages/cli/src/review-snapshot.ts',
  'scripts/verify-complexity-signals-snapshot.js',
  ...TESTS,
];

const repoRoot = path.join(__dirname, '..');
const node = process.execPath;

/**
 * 한 단계를 argv 배열로 실행하고 실패하면 그 단계 이름과 함께 즉시 종료한다. 셸 문자열을 쓰지 않아
 * 경로 보간으로 인한 인자 깨짐을 막고, 출력은 상속해 실패 지점이 호출자 로그에 남게 한다.
 *
 * @param {string} label - 단계 이름
 * @param {string} command - 실행 파일
 * @param {string[]} args - 인자
 * @returns {void} exit 0이면 반환한다. 아니면 같은 코드(신호 종료는 1)로 종료
 */
function step(label, command, args) {
  process.stdout.write(`\n== verify-complexity-signals-snapshot: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-complexity-signals-snapshot: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-complexity-signals-snapshot: ${label} failed (exit ${result.status})\n`);
    // 신호로 죽으면 status가 null이라 실패를 0으로 삼키지 않도록 1로 바꾼다.
    process.exit(result.status == null ? 1 : result.status);
  }
}

// 인자가 붙으면 범위를 잘못 고른 호출이므로 usage(2)로 막는다.
if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-complexity-signals-snapshot.js\n');
  process.exit(2);
}

step('build', 'npm', ['run', 'build']);
step('typecheck', 'npm', ['run', 'typecheck']);
step('tests', node, ['--test', ...TESTS]);
step('lint', 'npx', ['eslint', ...LINT_FILES]);
step('lint:test-names', node, ['scripts/check-test-names.js', ...TESTS]);
step('lint:context-comments', 'npm', ['run', 'lint:context-comments']);

process.stdout.write('\nverify-complexity-signals-snapshot: ok\n');
