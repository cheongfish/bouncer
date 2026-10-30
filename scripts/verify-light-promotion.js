'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// light 승격(promote-stop·promote-light·light revise 거절) task의 검증 범위다. 전체 CI는
// 마지막 verification task가 한 번만 돌리므로, 이 래퍼는 이 변경이 닿는 테스트와 정적 검사만 고른다.
const TESTS = [
  'test/coordinator.test.js',
  'test/cli-coordinate.test.js',
];
const LINT_FILES = [
  'packages/cli/src/coordinator-commands.ts',
  'packages/cli/src/coordinator-prepare.ts',
  'packages/cli/src/cli-git-commands.ts',
  'test/coordinator.test.js',
  'test/cli-coordinate.test.js',
  'scripts/verify-light-promotion.js',
];

const repoRoot = path.join(__dirname, '..');
const node = process.execPath;

/**
 * 한 단계를 argv 배열로 실행하고 실패하면 그 단계 이름과 함께 즉시 종료한다. 셸 문자열을
 * 쓰지 않는 이유는 경로 보간으로 인한 인자 깨짐을 막기 위해서다. 출력은 그대로 상속해 실패
 * 지점이 호출자 로그에 남게 한다.
 *
 * @param {string} label - stderr에 남길 단계 이름
 * @param {string} command - 실행 파일(npm·npx·node)
 * @param {string[]} args - 인자
 * @returns {void} exit 0이면 반환한다. 아니면 stderr 한 줄 뒤 같은 코드(없으면 1)로 종료
 */
function step(label, command, args) {
  process.stdout.write(`\n== verify-light-promotion: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-light-promotion: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-light-promotion: ${label} failed (exit ${result.status})\n`);
    process.exit(result.status == null ? 1 : result.status);
  }
}

// 인자를 받지 않는다. 인자가 붙으면 범위를 잘못 고른 호출이므로 usage(2)로 막는다.
if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-light-promotion.js\n');
  process.exit(2);
}

// 1. 테스트는 packages/cli/dist를 읽으므로 빌드가 먼저다.
step('build', 'npm', ['run', 'build']);
// 2. 이 변경이 닿는 두 테스트.
step('tests', node, ['--test', ...TESTS]);
// 3. 변경한 ts·js와 그 테스트·이 래퍼에 eslint를 건다.
step('lint', 'npx', ['eslint', ...LINT_FILES]);
// 4. 테스트 이름 규칙(`<condition> → <result>`).
step('lint:test-names', node, ['scripts/check-test-names.js', ...TESTS]);

process.stdout.write('\nverify-light-promotion: ok\n');
