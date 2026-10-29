'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// expected-paths task의 검증 묶음. 인자를 받지 않는다. 이 task가 바꾸는 commit guard·report·final-review
// 판정과 그 문서만 본다. 전체 CI(`npm run ci`)는 마지막 verification task가 한 번 돌리므로 여기서는
// 영역에 닿는 테스트와 정적 검사만 고른다.
const repoRoot = path.join(__dirname, '..');

// task가 바꾸는 테스트 파일. 단계 2(실행)와 단계 5(이름 규칙)가 같은 목록을 쓴다.
const TEST_FILES = [
  'test/commit-guard.test.js',
  'test/commit-hook.test.js',
  'test/commit-task.test.js',
  'test/composite-gates.test.js',
  'test/coordinator.test.js',
  'test/doc-shape-cli.test.js',
];

// 단계 3 eslint 대상: 바꾼 ts·js. 테스트 파일과 이 래퍼를 포함한다.
const LINT_FILES = [
  'packages/cli/src/commit-guard.ts',
  'packages/cli/src/scope.ts',
  'packages/cli/src/commit.ts',
  'packages/cli/src/composite-gates.ts',
  'packages/cli/src/execution-contracts.ts',
  'packages/cli/src/coordinator-commands.ts',
  'packages/cli/src/coordinator-repair.ts',
  'packages/cli/src/doc-shape-contracts.ts',
  'scripts/verify-expected-paths.js',
  ...TEST_FILES,
];

// 단계 4 문서 형식 검사 대상: 바꾼 문서 가운데 check-doc-shape 계약이 있는 것. 두 coordinator 카드와
// review-round.md는 계약이 없어 명시 인자로 주면 "no skill-shape contract"로 실패하므로 넣지 않는다.
const DOC_FILES = [
  'rules/cli.md',
  'rules/commit-scope.md',
  'agents/bouncer-implementer.md',
  'agents/bouncer-coordinator.md',
];

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
  process.stdout.write(`\n== verify-expected-paths: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-expected-paths: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-expected-paths: ${label} failed (exit ${result.status})\n`);
    process.exit(result.status == null ? 1 : result.status);
  }
}

// 인자를 받으면 검증 범위를 잘못 고른 호출이므로 실행하지 않고 usage로 끝낸다.
if (process.argv.length !== 2) {
  process.stderr.write('usage: node scripts/verify-expected-paths.js\n');
  process.exit(2);
}

const node = process.execPath;

// 1. 테스트는 packages/cli/dist를 읽으므로 빌드가 먼저다.
step('build', 'npm', ['run', 'build']);
// 2. 판정 테스트 여섯 개와 역할 문서 template을 읽는 agents 테스트.
step('tests', node, ['--test', ...TEST_FILES, 'test/agents.test.js']);
// 3. 바꾼 ts·js는 eslint 대상이다.
step('lint', 'npx', ['eslint', ...LINT_FILES]);
// 4. 바꾼 문서가 check-doc-shape 계약(제목 골격, 거절 표)을 지키는지 본다.
step('lint:docs', node, ['scripts/check-doc-shape.js', ...DOC_FILES]);
// 5. 바꾼 테스트의 이름이 "<condition> → <result>" 규칙을 지키는지 본다.
step('lint:test-names', node, ['scripts/check-test-names.js', ...TEST_FILES]);
// 6. 역할 문서(md)와 codex TOML 생성본이 어긋나지 않는지 본다.
step('check:emit', node, ['scripts/check-emit.js']);

process.stdout.write('\nverify-expected-paths: ok\n');
