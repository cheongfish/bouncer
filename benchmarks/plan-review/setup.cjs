#!/usr/bin/env node
'use strict';

// plan context review가 알려진 계획 결함을 놓치지 않는지 변경 전후로 재기 위한 fixture 생성기.
// 작은 계획(commit task 2개)과 큰 계획(commit task 4개)에 같은 종류의 결함 D1-D5를 심는다.
// 결함 외 문서는 plan gate를 통과하도록 써서, 측정이 "심은 결함을 잡았는가"만 가리키게 한다.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BOUNCER_BIN = path.join(REPO_ROOT, 'packages', 'cli', 'bin', 'bouncer');
const EPIC_DIR = '.bouncer/context/epics/001-plan-review';
const SMALL_DIR = `${EPIC_DIR}/blueprints/001-small`;
const LARGE_DIR = `${EPIC_DIR}/blueprints/002-large`;
// scaffold가 번들 index에 적는 요약과 epic frontmatter description이 같아야 구조 검사(S13)를 지난다.
const EPIC_DESCRIPTION = 'plan review defect measurement';
const TIMESTAMP = '2026-01-01T00:00:00.000+09:00';
const DEFECTS = ['D1', 'D2', 'D3', 'D4', 'D5'];

// 결함별 문구. 각 task 정의가 어느 결함을 담는지는 PLANS에서 고른다.
const D1_INTERFACE = '- 제공: `recordStatus(id, status)`. 상태는 runtime `state.json`에 저장한다.';
const D2_CHECKLIST = '- [ ] `src/shared/config.js`의 `STATUS_KEYS`에 새 키를 더한다.';

// 계획마다 task 정의. create는 새 파일, modify는 저장소에 이미 있어야 하는 파일이다.
// defects는 그 task에 심는 결함 id다(D3은 epic에 있어 task에 없다).
const PLANS = {
  small: {
    dir: SMALL_DIR,
    id: '001',
    title: '작은 계획',
    tasks: [
      { create: ['src/small/format.js', 'test/small/format.test.js'], modify: ['src/auth/session.ts'], defects: ['D1', 'D2', 'D4'] },
      { create: ['src/small/report.js', 'test/small/report.test.js'], modify: ['src/missing.ts'], defects: ['D5'] },
    ],
  },
  large: {
    dir: LARGE_DIR,
    id: '002',
    title: '큰 계획',
    tasks: [
      { create: ['src/large/format.js', 'test/large/format.test.js'], modify: [], defects: ['D1', 'D2'] },
      { create: ['src/large/report.js', 'test/large/report.test.js'], modify: ['src/auth/session.ts'], defects: ['D4'] },
      { create: ['src/large/export.js', 'test/large/export.test.js'], modify: ['src/missing.ts'], defects: ['D5'] },
      { create: ['src/large/summary.js', 'test/large/summary.test.js'], modify: [], defects: [] },
    ],
  },
};

/**
 * 코드가 붙은 Error를 만든다. CLI가 code로 exit 2와 exit 1을 가른다.
 *
 * @param {string} code - `invalid-target` | `command-failed`
 * @param {string} message - stderr에 낼 사유
 * @returns {Error} code 속성이 있는 Error
 */
function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

/**
 * 모든 외부 프로세스 호출이 거치는 spawnSync 래퍼. 실패하면 stderr를 그대로 담아 던진다.
 *
 * @param {string} file - 실행 파일
 * @param {string[]} args - 인자
 * @param {string} cwd - 실행 디렉터리
 * @param {object} [env] - 자식 환경. 기본은 현재 환경
 * @returns {string} stdout
 */
function run(file, args, cwd, env = process.env) {
  const result = spawnSync(file, args, { cwd, encoding: 'utf8', env });
  if (result.error || result.status !== 0) {
    // bouncer CLI는 게이트 실패 사유를 stdout JSON으로 내고 stderr는 비워 둔다. 사유가 사라지지 않게
    // stderr가 비면 stdout을 대신 싣는다.
    const stderr = result.error ? result.error.message : (result.stderr || result.stdout);
    throw codedError('command-failed', stderr);
  }
  return result.stdout;
}

function write(dir, rel, content) {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function doc(frontmatter, body) {
  return `---\n${frontmatter.trim()}\n---\n${body}\n`;
}

function commonMeta(rel, title, type, description = title) {
  return `type: ${type}
title: ${title}
description: ${description}
resource: ${rel}
tags:
  - bouncer
timestamp: '${TIMESTAMP}'`;
}

// D3: 판정할 수 없는 성공 기준이 epic에 들어 있다.
function epicDoc() {
  const rel = `${EPIC_DIR}/index.md`;
  return doc(`${commonMeta(rel, 'plan review 측정 epic', 'bouncer.epic', EPIC_DESCRIPTION)}
bouncer:
  id: '001'
  epic_id: '001'
  status: approved
  supersedes: []`, `# 001 plan review 측정 epic

## Intent
리뷰 진행 상태를 기록하는 모듈을 만든다.

## Success criteria
1. 리뷰 품질을 개선한다.
2. \`recordStatus\`가 상태를 기록하고 단위 테스트가 통과한다.`);
}

function blueprintDoc(plan) {
  const rel = `${plan.dir}/index.md`;
  return doc(`${commonMeta(rel, `${plan.title} blueprint`, 'bouncer.blueprint')}
bouncer:
  id: '${plan.id}'
  epic_id: '001'
  blueprint_id: '${plan.id}'
  status: approved
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []`, `# ${plan.id} ${plan.title}

Epic: [001](../../index.md)

## Intent
리뷰 진행 상태를 기록하는 모듈을 만든다.

## Contract
- 상태는 \`context-review.md\` frontmatter의 \`status\` 필드에 둔다. 다른 저장 위치를 두지 않는다.
- 검증 명령: \`npm test\``);
}

function tasksDoc(plan, n, task) {
  const id = String(n).padStart(3, '0');
  const rel = `${plan.dir}/tasks/${id}/tasks.md`;
  const defects = new Set(task.defects);
  const dependsOn = n === 1 ? '[]' : `\n    - TASKS-${String(n - 1).padStart(3, '0')}`;
  const paths = [...task.create, ...task.modify];
  // D4: 보안 경로를 건드리는데 review_risk를 비워 둔다. 결함이 없는 task도 같은 형식이다.
  const touchRows = [
    ...task.create.map((p) => `| \`${p}\` | 신규 | Create | 없음 | 모듈 추가 | 계획 구현 |`),
    ...task.modify.map((p) => `| \`${p}\` | 기존 | Modify | 기존 동작 | 상태 기록 연결 | 계획 구현 |`),
  ];
  return doc(`${commonMeta(rel, `${n}번째 모듈을 추가함`, 'bouncer.tasks')}
bouncer:
  id: TASKS-${id}
  epic_id: '001'
  blueprint_id: '${plan.id}'
  status: ready
  execution_kind: commit
  depends_on: ${dependsOn}
  parallel_safe: false
  dependency_gate: integrated
  verify: npm test
  affected_paths:
${paths.map((p) => `    - ${p}`).join('\n')}
  review_risk: []
  commit_intent:
    - ${n}번째 모듈을 추가한다.
  commit_summary:
    - '${n}번째 모듈과 테스트를 추가한다.'`, `# Tasks

Blueprint: [${plan.id}](../../index.md)

## Goal & intent
${n}번째 모듈을 추가하고 단위 테스트가 그 동작을 검증한다.

## Interface
${defects.has('D1') ? D1_INTERFACE : `- 제공: \`step${n}(x)\` (CommonJS export)`}

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
${touchRows.join('\n')}

## Do not touch
- \`package.json\`.

## Constraints
- 외부 의존성을 추가하지 않는다.

## Checklist
- [ ] \`${task.create[1]}\`를 먼저 쓰고 실패를 확인한 뒤 \`${task.create[0]}\`를 구현한다.
${defects.has('D2') ? `${D2_CHECKLIST}\n` : ''}- [ ] \`npm test\`가 통과한다.`);
}

function verificationDoc(plan, n, lastCommit) {
  const id = String(n).padStart(3, '0');
  const rel = `${plan.dir}/tasks/${id}/tasks.md`;
  return doc(`${commonMeta(rel, '전체 검증', 'bouncer.tasks')}
bouncer:
  id: TASKS-${id}
  epic_id: '001'
  blueprint_id: '${plan.id}'
  status: ready
  execution_kind: verification
  depends_on:
    - TASKS-${String(lastCommit).padStart(3, '0')}
  parallel_safe: false
  dependency_gate: integrated
  verify: npm test
  affected_paths: []
  review_risk: []`, `# Tasks

Blueprint: [${plan.id}](../../index.md)

## Goal & intent
모든 모듈이 통합된 뒤 \`npm test\`가 통과하는지 확인한다.

## Interface
- 없음: 코드를 바꾸지 않는다.

## Touch
- 없음

## Do not touch
- 모든 소스와 테스트 파일.

## Checklist
- [ ] \`npm test\`를 실행한다.`);
}

/**
 * task 번들의 짝 문서(verification·review)를 pending으로 만든다. plan 게이트의 구조 검사(S17)가
 * task마다 세 문서가 모두 있기를 요구하기 때문이다.
 */
function writeUnitSiblings(dir, plan, n) {
  const id = String(n).padStart(3, '0');
  for (const [kind, prefix] of [['verification', 'VERIFY'], ['review', 'REVIEW']]) {
    const rel = `${plan.dir}/tasks/${id}/${kind}.md`;
    const review = kind === 'review' ? '\n  review:\n    required: true' : '';
    write(dir, rel, doc(`${commonMeta(rel, kind, `bouncer.${kind}`)}
bouncer:
  id: ${prefix}-${id}
  epic_id: '001'
  blueprint_id: '${plan.id}'
  status: pending${review}`, `# ${kind}\n`));
  }
}

// 리뷰 전 상태. reviewer가 계획을 읽고 finding을 남기는 것이 측정 대상이므로 pending으로 둔다.
function contextReviewDoc(plan) {
  const rel = `${plan.dir}/context-review.md`;
  return doc(`${commonMeta(rel, `${plan.id} context review`, 'bouncer.context_review')}
bouncer:
  id: CTXREVIEW-${plan.id}
  epic_id: '001'
  blueprint_id: '${plan.id}'
  status: pending`, '# Context review\n');
}

/**
 * 결함을 심은 small·large 계획 fixture를 빈 디렉터리에 만든다. 대상 검증은 쓰기 전에 끝내므로
 * 거절 경로는 대상을 건드리지 않는다. git·bouncer 명령이 실패해도 이미 쓴 파일은 사용자
 * 디렉터리이므로 지우지 않는다.
 *
 * @param {string} dir - 존재하는 빈 디렉터리
 * @returns {{ ok: true, dir: string, blueprints: { small: string, large: string }, defects: string[] }}
 *   blueprints는 fixture 루트 기준 상대 경로, defects는 심은 결함 id다.
 * @throws {Error} `invalid-target`(없거나 비어 있지 않은 경로) | `command-failed`(git·bouncer 실패, stderr 포함)
 */
function setupPlanReview(dir) {
  // 1. 쓰기 전에 입력을 검증한다. 거절 때 대상에 흔적이 남으면 사용자가 재시도할 수 없다.
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (error) {
    // 없는 경로·디렉터리가 아닌 경로·권한 부족은 모두 "쓸 수 있는 빈 대상이 아님"이라 같은 거절로 접는다.
    // 원인은 message에 그대로 싣는다.
    throw codedError('invalid-target', `target is not a readable directory: ${dir} (${error.code || error.message})`);
  }
  if (entries.length > 0) throw codedError('invalid-target', `target directory is not empty: ${dir}`);

  // 2. 저장소에 이미 있어야 하는 Modify 대상. D5의 src/missing.ts는 일부러 만들지 않는다(G25).
  write(dir, 'package.json', `${JSON.stringify({ name: 'plan-review', version: '1.0.0', private: true, scripts: { test: 'node --test' } }, null, 2)}\n`);
  write(dir, 'src/auth/session.ts', 'export const session = {};\n');

  // 3. 문서. epic 골격과 `.bouncer/context/index.md`는 scaffold가 만들게 해 번들 index 형식을 복제하지 않는다.
  // 호출자 환경에 낡은 설치본이 걸려 있어도 이 저장소 CLI를 쓰도록 plugin root를 고정한다.
  const bouncerEnv = { ...process.env, BOUNCER_HOME: REPO_ROOT };
  run(process.execPath, [BOUNCER_BIN, 'scaffold', 'epic', '--id', '001', '--name', 'plan-review', '--description', EPIC_DESCRIPTION], dir, bouncerEnv);
  write(dir, `${EPIC_DIR}/index.md`, epicDoc());
  for (const plan of Object.values(PLANS)) {
    write(dir, `${plan.dir}/index.md`, blueprintDoc(plan));
    plan.tasks.forEach((task, i) => write(dir, `${plan.dir}/tasks/${String(i + 1).padStart(3, '0')}/tasks.md`, tasksDoc(plan, i + 1, task)));
    const verifyN = plan.tasks.length + 1;
    write(dir, `${plan.dir}/tasks/${String(verifyN).padStart(3, '0')}/tasks.md`, verificationDoc(plan, verifyN, plan.tasks.length));
    for (let n = 1; n <= verifyN; n += 1) writeUnitSiblings(dir, plan, n);
    write(dir, `${plan.dir}/context-review.md`, contextReviewDoc(plan));
  }

  // 4. 첫 커밋. 사용자 git 설정이 없어도 되도록 신원을 -c로 준다.
  run('git', ['init', '--quiet'], dir);
  run('git', ['add', '-A'], dir);
  run('git', ['-c', 'user.name=plan-review', '-c', 'user.email=plan-review@example.com', 'commit', '--quiet', '-m', 'chore: plan-review fixture'], dir);

  return { ok: true, dir, blueprints: { small: SMALL_DIR, large: LARGE_DIR }, defects: [...DEFECTS] };
}

/**
 * CLI 진입점. 거절은 exit 2, git·bouncer 실패는 stderr를 그대로 내고 exit 1이다.
 *
 * @param {string[]} argv - `<dir>`
 * @returns {number} 프로세스 exit code
 */
function main(argv) {
  const dir = argv.find((arg) => !arg.startsWith('--'));
  if (!dir) {
    process.stderr.write('usage: setup.cjs <dir>\n');
    return 2;
  }
  try {
    process.stdout.write(`${JSON.stringify(setupPlanReview(dir))}\n`);
    return 0;
  } catch (error) {
    if (error.code === 'invalid-target') {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    if (error.code === 'command-failed') {
      process.stderr.write(error.message);
      return 1;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { setupPlanReview };
