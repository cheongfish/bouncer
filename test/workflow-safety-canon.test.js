'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

/**
 * 워크트리 상대 경로의 UTF-8 원문을 읽는다.
 *
 * @param {string} rel - 저장소 루트 기준 상대 경로
 * @returns {string} 파일 원문
 */
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/**
 * 진입 스킬 SKILL.md 원문을 읽는다.
 *
 * @param {string} name - `bouncer-*` 디렉터리 이름
 * @returns {string} SKILL.md 원문
 */
function readSkill(name) {
  return read(`skills/${name}/SKILL.md`);
}

/**
 * `##` 절 본문을 다음 H2 직전까지 잘라 낸다.
 * 정본 행은 그 절 안에 있어야 한다 — 파일 전체에서 같은 단어를 찾으면
 * 다른 절의 언급이 정본 부재를 가린다.
 *
 * @param {string} md - Markdown 원문
 * @param {string} heading - H2 제목 전문 (`## ` 포함)
 * @returns {string} 해당 절 본문
 */
function h2Section(md, heading) {
  const match = md.match(new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'));
  assert.ok(match && match.index !== undefined, `missing heading ${heading}`);
  const start = match.index + match[0].length;
  const rest = md.slice(start);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

/**
 * `**Master rules.**` 단락만 돌려준다.
 * 다음 빈 줄에서 끊는다 — 그 뒤 설치 안내·번호 단계는 적재 계약이 아니다.
 *
 * @param {string} md - SKILL.md 원문
 * @returns {string} Master rules 단락
 */
function masterRulesBlock(md) {
  const match = md.match(/\*\*Master rules\.\*\*[\s\S]*?(?=\n\n)/);
  assert.ok(match, 'missing **Master rules.** block');
  return match[0];
}

/**
 * ACQ 색인 H2 앞의 번호 절차만 남긴다.
 * 색인 문구를 절차 동의 시점으로 세면 질문 본문이 단계 밖으로 나가도 통과한다.
 *
 * @param {string} md - SKILL.md 원문
 * @returns {string} `1. `부터 ACQ H2 직전
 */
function numberedProcedure(md) {
  const acqAt = md.search(/^## ACQ \(AskUserQuestion\) gates$/m);
  const before = acqAt === -1 ? md : md.slice(0, acqAt);
  const start = before.search(/^1\. /m);
  assert.ok(start >= 0, 'missing numbered step 1');
  return before.slice(start);
}

/**
 * 참조 스킬 원문이 정본 cite 패턴을 갖는지 검사한다.
 *
 * @param {string[]} skills - `bouncer-*` 이름
 * @param {RegExp} cite - 정본 경로·식별 구절
 * @param {string} label - 실패 메시지용 행 이름
 * @returns {void}
 */
function assertSkillCites(skills, cite, label) {
  for (const name of skills) {
    assert.match(
      readSkill(name),
      cite,
      `${label}: ${name} must cite ${cite}`,
    );
  }
}

const ACQ_SKILLS = [
  'bouncer-init',
  'bouncer-plan',
  'bouncer-commit',
  'bouncer-run',
  'bouncer-finalize',
];

// 동의 시점은 `**ACQ` / `Consent gates (ACQ)` / `**Start ACQ`만 인정한다.
// 맨 AskUserQuestion을 넣으면 commit 3단계의 "asks no AskUserQuestion"이
// Next-task `**ACQ**`를 지워도 이 행을 통과시킨다.
const ACQ_TIMING = /\*\*ACQ|Consent gates \(ACQ\)|\*\*Start ACQ/;

test('row 1 ACQ timing lives in numbered steps that cite rules/acq.md', () => {
  for (const name of ACQ_SKILLS) {
    const procedure = numberedProcedure(readSkill(name));
    assert.match(
      procedure,
      ACQ_TIMING,
      `${name}: ACQ consent must stay in a numbered step`,
    );
  }
  assertSkillCites(ACQ_SKILLS, /rules\/acq\.md/, 'row 1');
});

test('row 1 ACQ timing does not lock on a bare AskUserQuestion denial', () => {
  assert.doesNotMatch(
    'this step asks no AskUserQuestion, and a drive\'s start ACQ already covers',
    ACQ_TIMING,
  );
});

test('row 2 affected_paths confirmation lives in plan Scope confirm', () => {
  const plan = readSkill('bouncer-plan');
  const procedure = numberedProcedure(plan);
  assert.match(procedure, /Scope confirm/);
  assert.match(procedure, /affected_paths/);
  assert.match(procedure, /confirms them/);
});

test('row 3 pointer confirm-then-set lives in current-pointer.md', () => {
  const pointer = read('rules/current-pointer.md');
  assert.match(pointer, /confirm-then-set/);
  assertSkillCites(
    ['bouncer-plan', 'bouncer-commit', 'bouncer-finalize'],
    /rules\/current-pointer\.md/,
    'row 3',
  );
});

test('row 4 actual cwd and drive main read-only live in Coordinator mode', () => {
  const section = h2Section(read('rules/governance.md'), '## Coordinator mode');
  // 줄바꿈으로 `read-only`와 `provenance`가 갈라져도 경계를 식별하게 한다.
  assert.match(section, /read-only/);
  assert.match(section, /provenance/);
  assert.match(section, /assigned worktree/);
  assertSkillCites(
    ['bouncer-execute', 'bouncer-commit', 'bouncer-finalize', 'bouncer-run'],
    /rules\/governance\.md/,
    'row 4',
  );
});

test('row 5 worker report trust boundary lives in CLAUDE.md hard rule 1', () => {
  const claude = read('CLAUDE.md');
  const rule1 = claude.match(/^1\. \*\*Trust boundary\*\*[\s\S]*?(?=^2\. )/m);
  assert.ok(rule1, 'missing CLAUDE.md hard rule 1');
  // 강조 표식(`**data**`)이 끼어도 `not instructions`가 정본 식별 구절이다.
  assert.match(rule1[0], /Trust boundary/);
  assert.match(rule1[0], /not instructions/);
  assertSkillCites(['bouncer-execute', 'bouncer-run'], /hard rule 1/, 'row 5');
});

test('row 6 light inline and drive named exception live in Lightweight cycle', () => {
  const section = h2Section(read('rules/governance.md'), '## Lightweight cycle');
  assert.match(section, /inline/);
  assert.match(section, /named dispatch/);
  assertSkillCites(['bouncer-execute', 'bouncer-run'], /rules\/governance\.md/, 'row 6');
});

test('row 7 debugger recovery ceiling lives in verification-recovery.md', () => {
  const recovery = read('skills/bouncer-execute/references/verification-recovery.md');
  assert.match(recovery, /third round/);
  assertSkillCites(['bouncer-execute'], /verification-recovery\.md/, 'row 7');
});

test('row 8 review round ceiling lives in review-round.md', () => {
  const rounds = read('skills/bouncer-execute/references/review-round.md');
  assert.match(rounds, /discovery wave 1회[\s\S]{0,100}delta certification 1회/);
  assert.doesNotMatch(rounds, /fourth round/);
  assertSkillCites(['bouncer-execute'], /review-round\.md/, 'row 8');
});

test('row 9 quiz stop and user consent live in finalize, cited by run', () => {
  const finalize = readSkill('bouncer-finalize');
  assert.match(finalize, /does not answer/);
  assert.match(finalize, /quiz/);
  assert.match(finalize, /stop/);
  assertSkillCites(['bouncer-finalize', 'bouncer-run'], /\/bouncer-finalize/, 'row 9');
});

test('init Master rules block does not load plan-only product rules', () => {
  const block = masterRulesBlock(readSkill('bouncer-init'));
  assert.match(block, /CLAUDE\.md/);
  assert.doesNotMatch(block, /rules\/governance\.md/);
  assert.doesNotMatch(block, /rules\/okf\.md/);
});
