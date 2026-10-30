'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// light worker 경로 통일(TASKS-002)의 검증 범위다. 전체 CI는 종단 verification이 한 번만
// 돌리므로, 이 래퍼는 이 변경이 닿는 테스트와 정적 검사만 고른다.
const TESTS = [
  'test/coordinator.test.js',
  'test/coordinate-next.test.js',
  'test/coordinator-e2e.test.js',
  'test/cli-coordinate.test.js',
  'test/coordinate-advance.test.js',
  'test/run-preflight.test.js',
];
const LINT_FILES = [
  'packages/cli/src/coordinator-prepare.ts',
  'packages/cli/src/coordinate-next.ts',
  'packages/cli/src/coordinator-fanin.ts',
  'packages/cli/src/coordinator-commands.ts',
  'packages/cli/src/coordinator-ledger.ts',
  'packages/cli/src/coordinator-worker.ts',
  'packages/cli/src/cli-usage.ts',
  'scripts/verify-light-worker-path.js',
  'test/coordinator.test.js',
  'test/coordinate-next.test.js',
  'test/coordinator-e2e.test.js',
  'test/cli-coordinate.test.js',
];

const repoRoot = path.join(__dirname, '..');
const node = process.execPath;

/**
 * 한 단계를 argv 배열로 실행하고 실패하면 그 단계 이름과 함께 즉시 종료한다.
 *
 * @param {string} label - stderr에 남길 단계 이름
 * @param {string} command - 실행 파일(npm·npx·node)
 * @param {string[]} args - 인자
 * @returns {void} exit 0이면 반환한다. 아니면 stderr 한 줄 뒤 같은 코드(없으면 1)로 종료
 */
function step(label, command, args) {
  process.stdout.write(`\n== verify-light-worker-path: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-light-worker-path: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-light-worker-path: ${label} failed (exit ${result.status})\n`);
    process.exit(result.status == null ? 1 : result.status);
  }
}

if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-light-worker-path.js\n');
  process.exit(2);
}

step('build', 'npm', ['run', 'build']);
step('tests', node, ['--test', ...TESTS]);
step('lint', 'npx', ['eslint', ...LINT_FILES]);
step('lint:test-names', node, ['scripts/check-test-names.js', ...TESTS]);

process.stdout.write('\nverify-light-worker-path: ok\n');
