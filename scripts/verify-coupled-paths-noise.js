'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// coupled-paths 소음 수정(경로 경계 일치·서로게이트 안전 절단)의 검증 래퍼. 인자를 받지 않는다. 이 task의
// 검증 범위는 계획 점검 테스트와 그 파일에 닿는 정적 검사뿐이므로 전체 `npm run ci`는 돌리지 않는다.
// 전체 실행은 마지막 verification task가 한 번 맡는다.
const repoRoot = path.join(__dirname, '..');

/**
 * 한 단계를 argv 배열로 실행하고 실패하면 그 단계 이름과 함께 즉시 종료한다. 셸 문자열을 쓰지 않아
 * 경로 보간이 없고, 출력은 그대로 상속해 실패 지점이 호출자 로그에 남게 한다.
 *
 * @param {string} label - stderr에 남길 단계 이름
 * @param {string} command - 실행 파일(npm·npx·node)
 * @param {string[]} args - 인자
 * @returns {void} exit 0이면 반환한다. 아니면 stderr 한 줄 뒤 같은 코드(없으면 1)로 종료
 */
function step(label, command, args) {
  process.stdout.write(`\n== verify-coupled-paths-noise: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-coupled-paths-noise: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-coupled-paths-noise: ${label} failed (exit ${result.status})\n`);
    // signal로 죽으면 status가 null이다. 그때도 실패로 끝나도록 1을 준다.
    process.exit(result.status == null ? 1 : result.status);
  }
}

// 인자를 받지 않는 래퍼다. 인자가 있으면 잘못된 호출이므로 usage를 stderr에 쓰고 exit 2로 끝난다.
if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-coupled-paths-noise.js\n');
  process.exit(2);
}
const node = process.execPath;

// 1. 테스트는 packages/cli/dist를 읽으므로 빌드가 먼저다.
step('build', 'npm', ['run', 'build']);
// 2. 계획 점검 테스트 전체. 경계·서로게이트 테스트와 기존 coupledPaths 테스트가 함께 돈다.
step('tests', node, ['--test', 'test/plan-inspect.test.js']);
// 3. 바뀐 ts·js 파일 eslint. 이 래퍼도 검사 대상이다.
step('lint', 'npx', [
  'eslint',
  'packages/cli/src/plan-inspect.ts',
  'test/plan-inspect.test.js',
  'scripts/verify-coupled-paths-noise.js',
]);
// 4. 문서 형식 계약. rules/cli.md의 plan inspect 문단을 고쳤으므로 그 파일을 본다.
step('lint:docs', node, ['scripts/check-doc-shape.js', 'rules/cli.md']);
// 5. 테스트 이름 규칙(`<condition> → <result>`)과 boundary·surrogate 이름.
step('lint:test-names', node, ['scripts/check-test-names.js', 'test/plan-inspect.test.js']);
// 6. 타입 검사. 계획 점검 ts가 바뀌었으므로 필수다.
step('typecheck', 'npm', ['run', 'typecheck']);
// 7. 생성물 parity. 빌드 산출물이 추적 파일과 어긋나지 않는지 본다.
step('check:emit', node, ['scripts/check-emit.js']);

process.stdout.write('\nverify-coupled-paths-noise: ok\n');
