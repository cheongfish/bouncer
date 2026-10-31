'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// complexity 선언·gate·리뷰·원장 제거(TASKS-001)의 검증 범위다. 전체 CI
// (`npm run ci`)는 마지막 verification task가 한 번만 돌리므로, 이 래퍼는 이 변경이 닿는
// 테스트와 정적 검사만 고른다. 단계 순서는 빌드 → 테스트 → 정적 검사 → 테스트 이름
// 규칙으로, 앞 단계가 뒤 단계의 입력을 만든다. helpers/coordinator-fence.js는 목록에서 뺀다.
const TESTS = [
  'test/scaffold.test.js',
  'test/schema.test.js',
  'test/validate-structural.test.js',
  'test/cli-help.test.js',
  'test/migrate-context-slugs.test.js',
  'test/migrate-merge-legacy-epics.test.js',
  'test/validate-gates.test.js',
  'test/plan-approve.test.js',
  'test/plan-inspect.test.js',
  'test/finalize.test.js',
  'test/review-dispatch.test.js',
  'test/context-review-state.test.js',
  'test/run-preflight.test.js',
  'test/coordinate-next.test.js',
  'test/coordinator.test.js',
  'test/coordinator-e2e.test.js',
  'test/cli-coordinate.test.js',
  'test/commit-task.test.js',
];
const LINT_FILES = [
  'packages/cli/src/schema.ts',
  'packages/cli/src/scaffold.ts',
  'packages/cli/src/templates.ts',
  'packages/cli/src/cli-doc-commands.ts',
  'packages/cli/src/cli-usage.ts',
  'packages/cli/src/validate-structural.ts',
  'packages/cli/src/plan-snapshot-contract.ts',
  'packages/cli/src/plan-snapshot.ts',
  'packages/cli/src/validate-gates-plan.ts',
  'packages/cli/src/plan-approve.ts',
  'packages/cli/src/plan-inspect.ts',
  'packages/cli/src/review-dispatch.ts',
  'packages/cli/src/context-review-store.ts',
  'packages/cli/src/context-review-state.ts',
  'packages/cli/src/cli-review-dispatch-command.ts',
  'packages/cli/src/cli-context-review-command.ts',
  'packages/cli/src/run-preflight.ts',
  'packages/cli/src/coordinator-ledger.ts',
  'packages/cli/src/coordinator-prepare.ts',
  'packages/cli/src/coordinate-next.ts',
  'packages/cli/src/coordinator-repair.ts',
  'packages/cli/src/coordinator-fanin.ts',
  'packages/cli/src/coordinator-commands.ts',
  'packages/cli/src/coordinator-command-contracts.ts',
  'packages/cli/src/seed-worktree.ts',
  'packages/cli/src/cli-git-commands.ts',
  'packages/cli/src/execution-contracts.ts',
  'test/scaffold.test.js',
  'test/schema.test.js',
  'test/validate-structural.test.js',
  'test/cli-help.test.js',
  'test/migrate-context-slugs.test.js',
  'test/migrate-merge-legacy-epics.test.js',
  'test/validate-gates.test.js',
  'test/plan-approve.test.js',
  'test/plan-inspect.test.js',
  'test/finalize.test.js',
  'test/review-dispatch.test.js',
  'test/context-review-state.test.js',
  'test/run-preflight.test.js',
  'test/coordinate-next.test.js',
  'test/coordinator.test.js',
  'test/coordinator-e2e.test.js',
  'test/cli-coordinate.test.js',
  'test/commit-task.test.js',
  'test/helpers/coordinator-fence.js',
  'scripts/verify-complexity-declaration.js',
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
  process.stdout.write(`\n== verify-complexity-declaration: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(
      `verify-complexity-declaration: ${label} failed to spawn: ${result.error.message}\n`,
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-complexity-declaration: ${label} failed (exit ${result.status})\n`);
    process.exit(result.status == null ? 1 : result.status);
  }
}

if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-complexity-declaration.js\n');
  process.exit(2);
}

step('build', 'npm', ['run', 'build']);
step('tests', node, ['--test', ...TESTS]);
step('doc-shape', node, ['scripts/check-doc-shape.js']);
step('lint', 'npx', ['eslint', ...LINT_FILES]);
step('lint:test-names', node, ['scripts/check-test-names.js', ...TESTS]);

process.stdout.write('\nverify-complexity-declaration: ok\n');
