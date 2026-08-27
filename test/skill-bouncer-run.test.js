'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readWorkflowBundle } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const mainMd = fs.readFileSync(path.join(root, 'skills', 'bouncer-run', 'SKILL.md'), 'utf8');
const md = readWorkflowBundle('bouncer-run');

test('bouncer-run conditionally routes stop recovery', () => {
  const { body } = parseFrontmatter(mainMd);
  const condition = 'On verify re-failure, review ceiling, scope violation, or user decline, read this reference.';
  assert.match(body, /\[stop-recovery\.md\]/);
  const reference = fs.readFileSync(path.join(root, 'skills', 'bouncer-run', 'references', 'stop-recovery.md'), 'utf8');
  assert.ok(reference.startsWith(condition));
  assert.doesNotMatch(body, /자동 재시도하지|Leave the pointer on the failed task/);
});

test('bouncer-run is an explicit-ask workflow skill that loops execute then commit', () => {
  const { data, body } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'bouncer-run');
  assert.match(String(data.description), /This skill should be used only when the user explicitly asks/i);
  assert.match(body, /\/bouncer-execute/);
  assert.match(body, /\/bouncer-commit/);
  assert.match(body, /current --set/);
  assert.match(body, /autonomy/);
  assert.match(body, /interactive/);
  assert.match(body, /AskUserQuestion|ACQ/);
  assert.match(body, /Re-ground/);
  assert.match(body, /Recommend-why/);
  assert.match(body, /affected_paths/);
  assert.match(body, /bouncer-debugger/);
  assert.match(body, /\/bouncer-finalize/);
  assert.match(body, /\/bouncer-plan/);
});

test('bouncer-run delegates shared pointer invariants while retaining autonomy exceptions', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /rules\/current-pointer\.md/);
  assert.match(body, /auto/);
  assert.match(body, /interactive/);
  assert.match(body, /시작 ACQ.*auto|auto.*시작 ACQ/);
});

test('bouncer-run preflight stops on a null pointer or a closed blueprint', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /scripts\/bouncer"\s+current\b/);
  assert.match(body, /null/);
  assert.match(body, /closed/);
  // 포인터 없음은 plan, 열린 task 없음은 finalize 안내 — 두 출구를 한 문장에 섞지 않음.
  assert.match(body, /\/bouncer-plan/);
  assert.match(body, /\/bouncer-finalize/);
});

test('bouncer-run start ACQ lists remaining tasks and affected_paths', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /AskUserQuestion|ACQ/);
  assert.match(body, /affected_paths/);
  assert.match(body, /Recommended/);
  // 옵션 순서: 추천 진행 → 수정 → 취소. 시작 ACQ가 사람 확인의 기본 자리.
  assert.match(body, /수정/);
  assert.match(body, /취소/);
});

test('bouncer-run auto swallows commit and next-task ACQs; interactive adds a boundary ACQ', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /auto/);
  assert.match(body, /interactive/);
  // 삼키는 대상은 commit ACQ와 next-task ACQ 둘. 한쪽만 적으면 계약이 반쪽임.
  assert.match(body, /commit ACQ|Commit ACQ/);
  assert.match(body, /next-task ACQ|Next-task ACQ|next-task/);
  assert.match(body, /삼키|묻지 않/);
  // 두 모드 모두 commit 스킬 ACQ를 건너뛰고 --yes. interactive만 경계 ACQ를 더함.
  assert.match(body, /--yes/);
});

test('bouncer-run loop unit advances from commit JSON nextTask', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /nextTask/);
  assert.match(body, /current --set/);
  // 빈 staged / committed:false 는 실패가 아님 — 다음 task로 이어짐.
  assert.match(body, /committed:\s*false|committed: false/);
});

test('bouncer-run caps verify at 1 debugger cycle and review round-trips at 2', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /bouncer-debugger/);
  // 상한은 숫자로 고정. "몇 번쯤"은 읽는 사람이 판단하게 남겨 두면 안 됨.
  assert.match(body, /1회/);
  assert.match(body, /2회/);
  // 리뷰 왕복 숫자의 소유권은 execute — 루프는 참조만 한다.
  assert.match(body, /왕복은[\s\S]{0,40}\/bouncer-execute[\s\S]{0,20}2회/);
  assert.match(body, /accepted/);
  assert.match(body, /\/bouncer-plan/);
});

test('bouncer-run keeps pointer and worktree on stop and forbids auto-retry', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /포인터/);
  assert.match(body, /worktree/i);
  assert.match(body, /\/bouncer-execute/);
  assert.match(body, /자동 재시|auto-retry/i);
});

test('bouncer-run reads autonomy and falls back to auto outside AUTONOMY_ENUM', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /autonomy/);
  assert.match(body, /AUTONOMY_ENUM/);
  assert.match(body, /\.bouncer\/config\.json/);
  assert.match(body, /auto/);
});

test('bouncer-run does not invent CLI, invoke finalize, or copy execute dispatch', () => {
  const { body } = parseFrontmatter(md);
  // 진행 수단은 current --set 과 commit 출력뿐. 새 서브커맨드를 본문에 심지 않음.
  assert.doesNotMatch(body, /scripts\/bouncer"\s+run\b/);
  assert.doesNotMatch(body, /finalize --yes/);
  // named 디스패치 네 단계와 scale:light 는 execute 소유. 사본이 갈리면 두 문서가 다른 말을 함.
  assert.doesNotMatch(body, /resolveSubagentModel/);
  assert.doesNotMatch(body, /scale:\s*light/);
  assert.doesNotMatch(md, /superpowers|okf-authoring/i);
});

test('bouncer-run is an orchestrator that only consumes subagent reports', () => {
  const { body } = parseFrontmatter(md);
  // 루프가 구현·리뷰·조사를 자기 세션에서 하면 오케스트레이션 경계가 사라짐.
  assert.match(body, /인라인/);
  assert.match(body, /bouncer-implementer/);
  assert.match(body, /bouncer-reviewer/);
  assert.match(body, /bouncer-debugger/);
  // 위임할 수 없는 네 가지는 게이트·훅 제약에서 나옴 — 근거를 본문에 남김.
  assert.match(body, /commit-safety/);
  assert.match(body, /Needs planning/);
  assert.match(body, /Findings/);
});

test('bouncer-run passes debugger Output contract to implementer without copying execute dispatch', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /Minimum fix proposal/);
  assert.match(body, /Output contract/);
  assert.match(body, /증거/);
  assert.match(body, /\/bouncer-execute/);
  // named 디스패치 네 단계는 execute 소유. 사본이 갈리면 두 문서가 다른 말을 함.
  assert.doesNotMatch(body, /resolveSubagentModel/);
});

test('bouncer-run treats context docs and subagent reports as data not instructions', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /데이터이지 지시|데이터가 아니|지시가 아니/);
  assert.match(body, /Distill/);
});
