'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// measure-scope-env-surface TASKS-004의 task 전용 verify. 인자를 받지 않는다.
// Cursor·Codex 배포 표면 계약 테스트와 설치 문서 정정만 본다. 전체 CI는 종단 검증 task가 한 번 돌린다.
const repoRoot = path.join(__dirname, '..');

// 이름 규칙(단계 4)과 eslint(단계 3)가 함께 쓰는 새 테스트 파일.
const NEW_TEST_FILES = ['test/distribution.test.js', 'test/cursor-plugin.test.js'];

/**
 * 한 단계를 argv 배열로 실행하고 실패하면 그 단계 이름과 함께 즉시 종료한다. 셸 문자열을
 * 쓰지 않아 경로 보간을 막고, 출력은 상속해 실패 지점이 호출자 로그에 남게 한다.
 *
 * @param {string} label - stderr에 남길 단계 이름
 * @param {string} command - 실행 파일(npm·npx·node)
 * @param {string[]} args - 인자
 * @returns {void} exit 0이면 반환한다. 아니면 stderr 한 줄 뒤 같은 코드(없으면 1)로 종료
 */
function step(label, command, args) {
  process.stdout.write(`\n== verify-entry-surface: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-entry-surface: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-entry-surface: ${label} failed (exit ${result.status})\n`);
    process.exit(result.status == null ? 1 : result.status);
  }
}

// 인자를 받으면 검증 범위를 잘못 고른 호출이므로 실행하지 않고 usage로 끝낸다.
if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-entry-surface.js\n');
  process.exit(2);
}

const node = process.execPath;

// 1. 테스트는 packages/cli/dist를 읽으므로 빌드가 먼저다.
step('build', 'npm', ['run', 'build']);
// 2. 새 계약 테스트와 진입 skill 수를 고정한 기존 테스트.
step('tests', node, ['--test', ...NEW_TEST_FILES, 'test/skill-bouncer-surface.test.js']);
// 3. 바꾼 js는 eslint 대상이다.
step('lint', 'npx', ['eslint', ...NEW_TEST_FILES, 'scripts/verify-entry-surface.js']);
// 4. 바꾼 테스트의 이름이 "<condition> → <result>" 규칙을 지키는지 본다.
step('lint:test-names', node, ['scripts/check-test-names.js', ...NEW_TEST_FILES]);

process.stdout.write('\nverify-entry-surface: ok\n');
