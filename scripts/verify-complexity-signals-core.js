'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// 복잡도 신호 공용 모듈과 complexity 설정 키 task의 검증 범위다. 전체 CI(`npm run ci`)는 마지막
// verification task가 한 번만 돌리므로, 이 래퍼는 이 변경이 닿는 테스트와 정적 검사만 고른다.
// 단계 순서는 빌드 → typecheck → 테스트 → 정적 검사 → 테스트 이름 규칙 → 문서 형태로, 앞 단계가
// 뒤 단계의 입력(dist, 타입 오류 없는 소스)을 만든다.
const TESTS = [
  'test/complexity-signals.test.js',
  'test/plan-inspect.test.js',
  'test/cli-help.test.js',
  'test/init.test.js',
  'test/dependency-boundaries.test.js',
  'test/test-tiers.test.js',
  'test/skill-bouncer-surface.test.js',
];
const LINT_FILES = [
  'packages/cli/src/complexity-signals.ts',
  'packages/cli/src/plan-inspect.ts',
  'packages/cli/src/config.ts',
  'packages/cli/src/cli-config-command.ts',
  'scripts/verify-complexity-signals-core.js',
  ...TESTS,
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
  process.stdout.write(`\n== verify-complexity-signals-core: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-complexity-signals-core: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-complexity-signals-core: ${label} failed (exit ${result.status})\n`);
    // 신호로 죽으면 status가 null이라 실패를 0으로 삼키지 않도록 1로 바꾼다.
    process.exit(result.status == null ? 1 : result.status);
  }
}

// 인자를 받지 않는다. 인자가 붙으면 범위를 잘못 고른 호출이므로 usage(2)로 막는다.
if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-complexity-signals-core.js\n');
  process.exit(2);
}

// 1. 테스트는 packages/cli/dist를 읽으므로 빌드가 먼저다.
step('build', 'npm', ['run', 'build']);
// 2. 타입 오류는 빌드 산출만으로는 드러나지 않는 경계(import type)까지 본다.
step('typecheck', 'npm', ['run', 'typecheck']);
// 3. 이 변경이 닿는 일곱 테스트.
step('tests', node, ['--test', ...TESTS]);
// 4. 변경한 ts·js와 그 테스트에 eslint를 건다.
step('lint', 'npx', ['eslint', ...LINT_FILES]);
// 5. 테스트 이름 규칙(`<condition> → <result>`).
step('lint:test-names', node, ['scripts/check-test-names.js', ...TESTS]);
// 6. 한국어 why-주석 규칙.
step('lint:context-comments', 'npm', ['run', 'lint:context-comments']);
// 7. 문서(docs/configuration.md)를 바꾸므로 문서 형태 검사도 건다.
step('lint:docs', node, ['scripts/check-doc-shape.js']);

process.stdout.write('\nverify-complexity-signals-core: ok\n');
