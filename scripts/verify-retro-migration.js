'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// retro-reference blueprint의 task 검증 래퍼. 회고 절차를 finalize reference로 옮긴 변경이
// 닿는 네 테스트와 문서 형태·테스트 이름 정적 검사만 돌린다. 전체 CI는 마지막 verification
// task가 한 번 돌리므로 여기서는 범위를 넓히지 않는다.
const TESTS = [
  'test/skill-bouncer-surface.test.js',
  'test/cursor-plugin.test.js',
  'test/acq-gate-ids.test.js',
  'test/skill-bouncer-finalize.test.js',
];

const repoRoot = path.join(__dirname, '..');

/**
 * 한 단계를 argv 배열로 실행하고 실패하면 단계 이름과 함께 같은 종료 코드로 즉시 종료한다.
 * 셸 문자열을 쓰지 않아 경로 보간이 없고, 출력은 상속해 실패 지점이 호출자 로그에 남는다.
 *
 * @param {string} label - stderr에 남길 단계 이름
 * @param {string} command - 실행 파일(npm·node)
 * @param {string[]} args - 인자
 * @returns {void} exit 0이면 반환한다. 아니면 stderr 한 줄 뒤 종료 코드(없으면 1)로 종료
 */
function step(label, command, args) {
  process.stdout.write(`\n== verify-retro-migration: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-retro-migration: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-retro-migration: ${label} failed (exit ${result.status})\n`);
    process.exit(result.status == null ? 1 : result.status);
  }
}

// 1. 테스트는 packages/cli/dist를 읽으므로 빌드가 먼저다.
step('build', 'npm', ['run', 'build']);
step('tests', process.execPath, ['--test', ...TESTS]);
step('lint:docs', 'npm', ['run', 'lint:docs']);
step('lint:test-names', 'npm', ['run', 'lint:test-names']);

process.stdout.write('\nverify-retro-migration: ok\n');
