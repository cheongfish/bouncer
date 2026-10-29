'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveSpawn } = require('./spawn-win');

// model-tiers-followups blueprint의 task별 검증 범위. 각 task의 `verify`가 영역 이름 하나로
// 이 표를 가리키므로, 이후 task는 래퍼를 고치지 않고 자기 영역만 돌린다. 전체 CI(`npm run ci`)는
// 마지막 verification task가 한 번 돌리므로 여기서는 영역에 닿는 테스트와 정적 검사만 고른다.
// - tests: `node --test` 대상이자 `lint:test-names` 대상
// - lint: eslint 대상(영역이 바꾸는 ts·js 파일과 그 테스트)
// - docs: `lint:docs` 경로 계약이 있는 문서만. 계약 없는 문서를 넘기면 check-doc-shape가 실패한다
// - typecheck: 영역이 `packages/cli/src`의 ts를 바꾸면 true
const AREAS = {
  codex: {
    tests: [
      'test/agents.test.js',
      'test/init.test.js',
      'test/cli-init.test.js',
      'test/cli-project-commands.test.js',
      'test/distribution.test.js',
      // check-emit.js가 바뀌므로 그 fixture 계약 테스트도 같이 돈다.
      'test/ci-contract.test.js',
    ],
    lint: [
      'packages/cli/src/codex-agents.ts',
      'packages/cli/src/init.ts',
      'packages/cli/src/cli-project-commands.ts',
      'scripts/check-emit.js',
      'scripts/verify-model-tiers-followups.js',
    ],
    docs: ['rules/cli.md'],
    typecheck: true,
  },
  provider: {
    tests: [
      'test/subagent-model-hook.test.js',
      'test/subagents.test.js',
      'test/cli-project-commands.test.js',
    ],
    lint: [
      'hooks/subagent-model.js',
      'packages/cli/src/subagents.ts',
      'packages/cli/src/cli-project-commands.ts',
    ],
    docs: ['rules/cli.md'],
    typecheck: true,
  },
  metrics: {
    tests: ['test/cli-metrics.test.js'],
    lint: ['packages/cli/src/drive-metrics.ts'],
    docs: ['rules/cli.md'],
    typecheck: true,
  },
  plan: {
    tests: ['test/skill-bouncer-surface.test.js'],
    lint: [],
    docs: ['skills/bouncer-plan/SKILL.md'],
    typecheck: false,
  },
};

const repoRoot = path.join(__dirname, '..');

/**
 * 한 단계를 argv 배열로 실행하고 실패하면 그 단계 이름과 함께 즉시 종료한다. 셸 문자열을
 * 쓰지 않는 이유는 check-emit과 같다(경로 보간 금지). 출력은 그대로 상속해 실패 지점이
 * 호출자 로그에 남게 한다.
 *
 * @param {string} label - stderr에 남길 단계 이름
 * @param {string} command - 실행 파일(npm·npx·node)
 * @param {string[]} args - 인자
 * @returns {void} exit 0이면 반환한다. 아니면 stderr 한 줄 뒤 같은 코드(없으면 1)로 종료
 */
function step(label, command, args) {
  process.stdout.write(`\n== verify-model-tiers-followups: ${label}\n`);
  const call = resolveSpawn(command, args);
  const result = spawnSync(call.command, call.args, { cwd: repoRoot, stdio: 'inherit', shell: call.shell });
  if (result.error) {
    process.stderr.write(`verify-model-tiers-followups: ${label} failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(`verify-model-tiers-followups: ${label} failed (exit ${result.status})\n`);
    process.exit(result.status == null ? 1 : result.status);
  }
}

const area = process.argv[2];
if (process.argv.length !== 3 || !Object.hasOwn(AREAS, area)) {
  process.stderr.write(`usage: node scripts/verify-model-tiers-followups.js <${Object.keys(AREAS).join('|')}>\n`);
  process.exit(2);
}
const spec = AREAS[area];
const node = process.execPath;

// 1. 테스트는 packages/cli/dist를 읽으므로 빌드가 먼저다.
step('build', 'npm', ['run', 'build']);
// 2. 영역 테스트.
step('tests', node, ['--test', ...spec.tests]);
// 3. CI 정적 검사 중 영역 파일에 닿는 것만. 테스트 파일도 eslint 대상이다.
step('lint', 'npx', ['eslint', ...spec.lint, ...spec.tests]);
if (spec.docs.length > 0) step('lint:docs', node, ['scripts/check-doc-shape.js', ...spec.docs]);
step('lint:test-names', node, ['scripts/check-test-names.js', ...spec.tests]);
if (spec.typecheck) step('typecheck', 'npm', ['run', 'typecheck']);
// 4. 생성물 parity: emit 미추적·ignore와 index의 `.codex/agents` 생성본 일치를 본다.
step('check:emit', node, ['scripts/check-emit.js']);

process.stdout.write(`\nverify-model-tiers-followups: ${area} ok\n`);
