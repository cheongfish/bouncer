'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// handoff-order-docs task의 검증 묶음. 인자를 받지 않는다. 이 task가 바꾸는 drive-metrics 순서 문장과
// direct-run Handoff 실패 단계 고정이 한 번에 맞는지만 본다. 전체 CI(`npm run ci`)는 마지막
// verification task가 한 번 돌리므로 여기서는 영역에 닿는 테스트와 정적 검사만 고른다.
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
  process.stdout.write(`\n== verify-handoff-order-docs: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-handoff-order-docs: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-handoff-order-docs: ${label} failed (exit ${result.status})\n`);
    process.exit(result.status == null ? 1 : result.status);
  }
}

// 인자를 받으면 검증 범위를 잘못 고른 호출이므로 실행하지 않고 usage로 끝낸다.
if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-handoff-order-docs.js\n');
  process.exit(2);
}

const node = process.execPath;

// 1. 테스트는 packages/cli/dist를 읽으므로 빌드가 먼저다.
step('build', 'npm', ['run', 'build']);
// 2. 순서 문장과 Handoff 실패 단계 테스트, 그리고 drive-metrics 경로 계약 테스트.
step('tests', node, ['--test', 'test/skill-bouncer-run.test.js', 'test/doc-shape-cli.test.js']);
// 3. 테스트 파일과 이 래퍼는 eslint 대상이다.
step('lint', 'npx', ['eslint', 'test/skill-bouncer-run.test.js', 'scripts/verify-handoff-order-docs.js']);
// 4. drive-metrics의 제목 골격과 문서 형식이 check-doc-shape 계약을 지키는지 본다.
step('lint:docs', node, ['scripts/check-doc-shape.js', 'skills/bouncer-run/references/drive-metrics.md']);
// 5. 새 테스트 이름이 "<condition> → <result>" 규칙을 지키는지 본다.
step('lint:test-names', node, ['scripts/check-test-names.js', 'test/skill-bouncer-run.test.js']);

process.stdout.write('\nverify-handoff-order-docs: ok\n');
