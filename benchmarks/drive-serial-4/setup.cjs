#!/usr/bin/env node
'use strict';

// 같은 직렬 4-task 계획을 baseline / auto / direct 세 방식으로 돌려 비교하기 위한 fixture 생성기.
// 세 방식의 계획 문서는 동일하고 `.bouncer/config.json`만 다르다. 그래야 측정 차이가 계획이 아니라
// 실행 방식에서 나온다고 말할 수 있다.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_BOUNCER_BIN = path.join(REPO_ROOT, 'scripts', 'bouncer');
const EPIC_DIR = '.bouncer/context/epics/001-drive-serial';
const BLUEPRINT_DIR = `${EPIC_DIR}/blueprints/001-serial-four`;
// scaffold가 번들 index에 적는 요약과 epic frontmatter description이 같아야 구조 검사(S13)를 지난다.
const EPIC_DESCRIPTION = 'serial four task measurement';
const STEPS = [1, 2, 3, 4];
const TIMESTAMP = '2026-01-01T00:00:00.000+09:00';

// 모드별 coordinator 설정. direct는 task 4개를 직접 실행 상한(기본 3) 안에 넣기 위해 상한을 4로 올린다.
const MODE_CONFIG = {
  baseline: { coordinator: { waves_per_session: 1 } },
  auto: { coordinator: { waves_per_session: 'auto' } },
  direct: { coordinator: { waves_per_session: 'auto', direct_max_commit_tasks: 4 } },
};

/**
 * 코드가 붙은 Error를 만든다. CLI가 code로 exit 2와 exit 1을 가른다.
 *
 * @param {string} code - `invalid-target` | `invalid-mode`
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
    throw Object.assign(new Error(stderr), { code: 'command-failed', stderr });
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

function epicDoc() {
  const rel = `${EPIC_DIR}/index.md`;
  return doc(`${commonMeta(rel, '직렬 4-task 측정 epic', 'bouncer.epic', EPIC_DESCRIPTION)}
bouncer:
  id: '001'
  epic_id: '001'
  status: approved
  supersedes: []`, '# 001 직렬 4-task 측정 epic\n\n## Intent\n같은 직렬 계획을 실행 방식별로 비교한다.');
}

function blueprintDoc() {
  const rel = `${BLUEPRINT_DIR}/index.md`;
  return doc(`${commonMeta(rel, '직렬 4-task 측정 blueprint', 'bouncer.blueprint')}
bouncer:
  id: '001'
  epic_id: '001'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []`, '# 001 직렬 4-task 측정 blueprint\n\nEpic: [001](../../index.md)\n\n## Intent\n앞 단계 모듈을 이어 받는 4개 모듈을 차례로 만든다.');
}

function commitTaskDoc(n) {
  const id = String(n).padStart(3, '0');
  const rel = `${BLUEPRINT_DIR}/tasks/${id}/tasks.md`;
  const dependsOn = n === 1 ? '[]' : `\n    - TASKS-${String(n - 1).padStart(3, '0')}`;
  return doc(`${commonMeta(rel, `step${n} 모듈을 추가함`, 'bouncer.tasks')}
bouncer:
  id: TASKS-${id}
  epic_id: '001'
  blueprint_id: '001'
  status: ready
  execution_kind: commit
  depends_on: ${dependsOn}
  parallel_safe: false
  dependency_gate: integrated
  verify: npm test
  affected_paths:
    - src/step${n}.js
    - test/step${n}.test.js
  review_risk: []
  commit_intent:
    - step${n} 모듈을 추가한다.
  commit_summary:
    - '\`src/step${n}.js\`와 테스트를 추가한다.'`, `# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
\`src/step${n}.js\`가 \`step${n}(x)\`를 내보내고 \`test/step${n}.test.js\`가 그 동작을 검증한다.${n > 1 ? ` step${n - 1}의 결과를 입력으로 받는다.` : ''}

## Target behavior
- \`step${n}(x)\`는 \`x + ${n}\`을 돌려준다.

## Interface
- 제공: \`step${n}(x)\` (CommonJS export)

## Touch
- Create \`src/step${n}.js\`
- Create \`test/step${n}.test.js\`

## Do not touch
- 다른 step 모듈과 \`package.json\`.

## Constraints
- 외부 의존성을 추가하지 않는다.

## Checklist
- [ ] \`test/step${n}.test.js\`를 먼저 쓰고 실패를 확인한 뒤 \`src/step${n}.js\`를 구현한다.`);
}

function verificationTaskDoc() {
  const rel = `${BLUEPRINT_DIR}/tasks/005/tasks.md`;
  return doc(`${commonMeta(rel, '전체 검증', 'bouncer.tasks')}
bouncer:
  id: TASKS-005
  epic_id: '001'
  blueprint_id: '001'
  status: ready
  execution_kind: verification
  depends_on:
    - TASKS-004
  parallel_safe: false
  dependency_gate: integrated
  verify: npm test
  affected_paths: []
  review_risk: []`, `# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
네 step 모듈이 모두 통합된 뒤 \`npm test\`가 통과하는지 확인한다.

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
 * task 번들의 짝 문서(verification·review)를 pending으로 만든다. `current --set`이 타는 plan 게이트의
 * 구조 검사(S17)가 task마다 세 문서가 모두 있기를 요구하기 때문이다.
 *
 * @param {string} dir - fixture 루트
 * @param {number} n - task 번호
 */
function writeUnitSiblings(dir, n) {
  const id = String(n).padStart(3, '0');
  for (const [kind, prefix] of [['verification', 'VERIFY'], ['review', 'REVIEW']]) {
    const rel = `${BLUEPRINT_DIR}/tasks/${id}/${kind}.md`;
    const review = kind === 'review' ? '\n  review:\n    required: true' : '';
    write(dir, rel, doc(`${commonMeta(rel, kind, `bouncer.${kind}`)}
bouncer:
  id: ${prefix}-${id}
  epic_id: '001'
  blueprint_id: '001'
  status: pending${review}`, `# ${kind}\n`));
  }
}

// plan 게이트 G18은 accepted context-review를 요구한다. 측정 대상은 계획 리뷰가 아니라 드라이브이므로
// finding 없는 accepted 기록을 미리 둔다.
function contextReviewDoc() {
  const rel = `${BLUEPRINT_DIR}/context-review.md`;
  return doc(`${commonMeta(rel, '001 context review', 'bouncer.context_review')}
bouncer:
  id: CTXREVIEW-001
  epic_id: '001'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings: []`, '# Context review\n\n## Findings\n(none)');
}

/**
 * 직렬 4-task fixture를 빈 디렉터리에 만든다. 대상 검증은 쓰기 전에 끝내므로 거절 경로는 대상을
 * 건드리지 않는다. git·포인터 설정이 실패하면 이미 쓴 파일은 사용자 디렉터리이므로 지우지 않는다.
 *
 * @param {string} dir - 존재하는 빈 디렉터리
 * @param {object} opts
 * @param {string} opts.mode - `baseline` | `auto` | `direct`
 * @param {string} [opts.bouncerBin] - `bouncer current --set`에 쓸 launcher. 기본은 이 저장소의 scripts/bouncer
 * @returns {{ blueprintDir: string }} 포인터가 가리키는 blueprint 상대 경로
 * @throws {Error} `invalid-target`(없거나 비어 있지 않은 경로) | `invalid-mode` | `command-failed`(git·bouncer 실패, stderr 포함)
 */
function setupDriveSerial4(dir, { mode, bouncerBin = DEFAULT_BOUNCER_BIN } = {}) {
  // 1. 쓰기 전에 입력을 모두 검증한다. 거절 때 대상에 흔적이 남으면 사용자가 재시도할 수 없다.
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (error) {
    // 없는 경로·디렉터리가 아닌 경로·권한 부족은 모두 "쓸 수 있는 빈 대상이 아님"이라 같은 거절로 접는다.
    // 원인은 message에 그대로 싣는다.
    throw codedError('invalid-target', `target is not a readable directory: ${dir} (${error.code || error.message})`);
  }
  if (entries.length > 0) throw codedError('invalid-target', `target directory is not empty: ${dir}`);
  if (!Object.prototype.hasOwnProperty.call(MODE_CONFIG, mode)) {
    throw codedError('invalid-mode', `unknown --mode: ${mode} (expected baseline|auto|direct)`);
  }

  // 2. 파일 생성. 계획 문서는 모드와 무관하게 같다.
  write(dir, 'package.json', `${JSON.stringify({ name: 'drive-serial-4', version: '1.0.0', private: true, scripts: { test: 'node --test' } }, null, 2)}\n`);
  write(dir, '.bouncer/config.json', `${JSON.stringify(MODE_CONFIG[mode], null, 2)}\n`);
  // epic 골격과 `.bouncer/context/index.md`는 scaffold가 만들게 해 번들 index 형식을 복제하지 않는다.
  // launcher는 BOUNCER_HOME 등으로 고른 설치본에 위임한다. 호출자 환경에 낡은 설치본이 걸려 있어도
  // 이 fixture가 지정한 bouncerBin의 저장소 CLI를 쓰도록 plugin root를 고정한다.
  const bouncerEnv = { ...process.env, BOUNCER_HOME: path.dirname(path.dirname(bouncerBin)) };
  run(process.execPath, [bouncerBin, 'scaffold', 'epic', '--id', '001', '--name', 'drive-serial', '--description', EPIC_DESCRIPTION], dir, bouncerEnv);
  write(dir, `${EPIC_DIR}/index.md`, epicDoc());
  write(dir, `${BLUEPRINT_DIR}/index.md`, blueprintDoc());
  for (const n of STEPS) write(dir, `${BLUEPRINT_DIR}/tasks/${String(n).padStart(3, '0')}/tasks.md`, commitTaskDoc(n));
  write(dir, `${BLUEPRINT_DIR}/tasks/005/tasks.md`, verificationTaskDoc());
  for (const n of [...STEPS, 5]) writeUnitSiblings(dir, n);
  write(dir, `${BLUEPRINT_DIR}/context-review.md`, contextReviewDoc());

  // 3. 첫 커밋. 사용자 git 설정이 없어도 되도록 신원을 -c로 준다.
  run('git', ['init', '--quiet'], dir);
  run('git', ['add', '-A'], dir);
  run('git', ['-c', 'user.name=drive-serial-4', '-c', 'user.email=drive-serial-4@example.com', 'commit', '--quiet', '-m', 'chore: drive-serial-4 fixture'], dir);

  // 4. 포인터. 커밋 뒤에 두어 base 브랜치가 존재하게 한다.
  run(process.execPath, [bouncerBin, 'current', '--set', BLUEPRINT_DIR], dir, bouncerEnv);
  return { blueprintDir: BLUEPRINT_DIR };
}

/**
 * CLI 진입점. 거절은 exit 2, git·bouncer 실패는 stderr를 그대로 내고 exit 1이다.
 *
 * @param {string[]} argv - `<dir> --mode <mode>`
 * @returns {number} 프로세스 exit code
 */
function main(argv) {
  const modeIndex = argv.indexOf('--mode');
  const mode = modeIndex >= 0 ? argv[modeIndex + 1] : undefined;
  const dir = argv.find((arg, i) => !arg.startsWith('--') && i !== modeIndex + 1);
  if (!dir) {
    process.stderr.write('usage: setup.cjs <dir> --mode <baseline|auto|direct>\n');
    return 2;
  }
  try {
    process.stdout.write(`${JSON.stringify(setupDriveSerial4(dir, { mode }))}\n`);
    return 0;
  } catch (error) {
    if (error.code === 'invalid-target' || error.code === 'invalid-mode') {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    if (error.code === 'command-failed') {
      process.stderr.write(error.stderr);
      return 1;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { setupDriveSerial4 };
