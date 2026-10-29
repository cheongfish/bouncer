'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// 역할 문서 규칙 task(TASKS-002)의 검증 묶음. 인자를 받지 않고 항상 같은 순서로 돈다.
// 전체 CI(`npm run ci`)는 마지막 verification task가 한 번 돌리므로 여기서는 역할 문서와
// 그 생성본(TOML)에 닿는 테스트와 정적 검사만 고른다.

const repoRoot = path.join(__dirname, '..');

/**
 * 한 단계를 argv 배열로 실행하고 실패하면 그 단계 이름과 함께 즉시 종료한다. 셸 문자열을
 * 쓰지 않는 이유는 경로 보간을 막기 위해서다. 출력은 그대로 상속해 실패 지점이 호출자 로그에 남게 한다.
 *
 * @param {string} label - stderr에 남길 단계 이름
 * @param {string} command - 실행 파일(npm·npx·node)
 * @param {string[]} args - 인자
 * @returns {void} exit 0이면 반환한다. 아니면 stderr 한 줄 뒤 같은 코드(없으면 1)로 종료
 */
function step(label, command, args) {
  process.stdout.write(`\n== verify-role-doc-rules: ${label}\n`);
  // Windows의 npm·npx는 .cmd shim이라 resolveSpawn이 실행 방식을 바꿔야 spawn이 된다.
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-role-doc-rules: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-role-doc-rules: ${label} failed (exit ${result.status})\n`);
    // status가 null이면 신호로 죽은 것이므로 실패 코드 1로 맞춘다.
    process.exit(result.status == null ? 1 : result.status);
  }
}

// 인자를 받지 않는 고정 검증이므로 인자가 하나라도 있으면 잘못된 호출로 거부한다.
if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-role-doc-rules.js\n');
  process.exit(2);
}
const node = process.execPath;

// 1. 테스트는 packages/cli/dist를 읽으므로 빌드가 먼저다.
step('build', 'npm', ['run', 'build']);
// 2. 역할 문서 단언과 skill 문서 단언.
step('tests', node, ['--test', 'test/agents.test.js', 'test/skill-bouncer-run.test.js']);
// 3. 테스트 파일과 이 래퍼 자신이 eslint를 통과해야 한다.
step('lint', 'npx', ['eslint', 'test/agents.test.js', 'scripts/verify-role-doc-rules.js']);
// 4. 역할 문서의 제목 골격.
step('lint:docs', node, [
  'scripts/check-doc-shape.js', 'agents/bouncer-implementer.md', 'agents/bouncer-coordinator.md',
]);
step('lint:test-names', node, ['scripts/check-test-names.js', 'test/agents.test.js']);
// 5. 생성물 parity: index의 `.codex/agents` 생성본이 md 변환과 같은지 본다.
step('check:emit', node, ['scripts/check-emit.js']);

process.stdout.write('\nverify-role-doc-rules: ok\n');
