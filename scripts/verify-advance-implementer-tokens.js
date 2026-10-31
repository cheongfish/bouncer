'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// advance의 worker-tokens-missing 검사를 모든 task의 구현자 키까지 넓힌 변경의 검증 범위다. 전체 CI(`npm run ci`)는
// 마지막 verification task가 한 번만 돌리므로, 이 래퍼는 이 변경이 닿는 테스트와 정적 검사만 고른다.
// 단계 순서는 빌드 → 테스트 → 정적 검사 → 문서·이름 규칙 → 타입 → 생성물 parity로, 앞 단계가 뒤 단계의 입력을 만든다.
const TESTS = [
  'test/cli-coordinate.test.js',
  'test/coordinator.test.js',
  'test/coordinate-next.test.js',
  // advance 경로(coordinate-advance)와 CLI 경계 짝 테스트: 가드 호출처와 패키지 경계가 같이 깨지는지 본다.
  'test/coordinate-advance.test.js',
  // 짝 테스트 2개: rules/cli.md 문구를 읽으므로 문서 변경이 만든 깨짐이 이 래퍼 안에서 드러나게 한다.
  'test/doc-shape-cli.test.js',
  'test/dependency-boundaries.test.js',
];
const LINT_FILES = [
  'packages/cli/src/coordinator-commands.ts',
  'test/cli-coordinate.test.js',
  'test/coordinator.test.js',
  'test/coordinate-next.test.js',
  'scripts/verify-advance-implementer-tokens.js',
];
// 테스트 이름 규칙은 새 테스트를 더한 파일에만 건다.
const NAME_FILES = TESTS.slice(0, 3);
const DOCS = ['rules/cli.md'];

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
  process.stdout.write(`\n== verify-advance-implementer-tokens: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-advance-implementer-tokens: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-advance-implementer-tokens: ${label} failed (exit ${result.status})\n`);
    // 신호로 죽으면 status가 null이라 실패를 0으로 삼키지 않도록 1로 바꾼다.
    process.exit(result.status == null ? 1 : result.status);
  }
}

// 인자를 받지 않는다. 인자가 붙으면 범위를 잘못 고른 호출이므로 usage(2)로 막는다.
if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-advance-implementer-tokens.js\n');
  process.exit(2);
}

// 1. 테스트는 packages/cli/dist를 읽으므로 빌드가 먼저다.
step('build', 'npm', ['run', 'build']);
// 2. 이 변경이 닿는 coordinator·CLI·advance 테스트와 짝 테스트.
step('tests', node, ['--test', ...TESTS]);
// 3. 변경한 ts·js와 그 테스트에 eslint를 건다.
step('lint', 'npx', ['eslint', ...LINT_FILES]);
// 4. rules/cli.md 문서 형식 계약.
step('lint:docs', node, ['scripts/check-doc-shape.js', ...DOCS]);
// 5. 테스트 이름 규칙(`<condition> → <result>`).
step('lint:test-names', node, ['scripts/check-test-names.js', ...NAME_FILES]);
// 6. packages/cli/src의 ts를 바꿨으므로 타입 검사를 건다.
step('typecheck', 'npm', ['run', 'typecheck']);
// 7. 생성물 parity: emit 미추적·ignore와 생성본 일치.
step('check:emit', node, ['scripts/check-emit.js']);

process.stdout.write('\nverify-advance-implementer-tokens: ok\n');
