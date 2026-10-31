'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// worker-model의 --strategy·--reviewer-tier 기록(complexity-signals의 worker 플래그 단계)의
// 검증 범위다. 전체 CI(`npm run ci`)는 마지막 verification task가 한 번만 돌리므로, 이 래퍼는
// 이 변경이 닿는 테스트와 정적 검사만 고른다. 단계 순서는 빌드 → 타입 → 문서 형태 → 테스트 →
// eslint → 테스트 이름 규칙 → context-comments로, 앞 단계가 뒤 단계의 입력을 만든다.
// 빌드를 먼저 하는 이유는 테스트가 packages/cli/dist를 읽기 때문이다(dist는 gitignore 대상).
const TESTS = [
  'test/coordinator.test.js',
  'test/cli-coordinate.test.js',
  'test/cli-help.test.js',
  'test/coordinator-e2e.test.js',
  'test/cli-metrics.test.js',
  'test/doc-shape-cli.test.js',
  'test/skill-bouncer-run.test.js',
  'test/reviewer-tier-docs.test.js',
];
// 이 변경이 고친 ts/js 파일만 린트한다. 전체 린트는 다른 task의 파일까지 섞어 실패 원인을 흐린다.
const LINT_FILES = [
  'packages/cli/src/coordinator-commands.ts',
  'packages/cli/src/coordinator-command-contracts.ts',
  'packages/cli/src/cli-git-commands.ts',
  'packages/cli/src/cli-usage.ts',
  'test/coordinator.test.js',
  'test/cli-coordinate.test.js',
  'test/cli-help.test.js',
  'test/reviewer-tier-docs.test.js',
  'scripts/verify-complexity-signals-worker-flags.js',
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
  process.stdout.write(`\n== verify-complexity-signals-worker-flags: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(
      `verify-complexity-signals-worker-flags: ${label} failed to spawn: ${result.error.message}\n`,
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-complexity-signals-worker-flags: ${label} failed (exit ${result.status})\n`);
    process.exit(result.status == null ? 1 : result.status);
  }
}

if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-complexity-signals-worker-flags.js\n');
  process.exit(2);
}

step('build', 'npm', ['run', 'build']);
step('typecheck', 'npm', ['run', 'typecheck']);
step('doc-shape', node, ['scripts/check-doc-shape.js']);
step('tests', node, ['--test', ...TESTS]);
step('lint', 'npx', ['eslint', ...LINT_FILES]);
step('lint:test-names', node, ['scripts/check-test-names.js', ...TESTS]);
step('lint:context-comments', 'npm', ['run', 'lint:context-comments']);

process.stdout.write('\nverify-complexity-signals-worker-flags: ok\n');
