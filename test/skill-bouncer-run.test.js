'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { checkDocShape } = require('../scripts/check-doc-shape');
const { readWorkflowBundle } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const mainMd = fs.readFileSync(path.join(root, 'skills', 'bouncer-run', 'SKILL.md'), 'utf8');
const md = readWorkflowBundle('bouncer-run');

function assertShape(document, contract) {
  const result = checkDocShape(document, contract);
  assert.deepStrictEqual(result.errors, [], result.errors.join('; '));
  return result.shape;
}

test('bouncer-run conditionally routes stop recovery', () => {
  const { body } = parseFrontmatter(mainMd);
  assertShape(mainMd, {
    filePath: path.join(root, 'skills', 'bouncer-run', 'SKILL.md'),
    links: [{ href: './references/stop-recovery.md', resolve: true, referencePreamble: true, conditionalLoad: { triggers: ['fail'] } }],
  });
  assert.match(body, /\]\(\.\/references\/stop-recovery\.md\)/);
  assert.doesNotMatch(body, /자동 재시도하지|Leave the pointer on the failed task/);
});

test('bouncer-run rejects unrelated stop-recovery routes', () => {
  const result = checkDocShape('When publishing a release, read [Reference](./references/stop-recovery.md).', {
    filePath: path.join(root, 'skills', 'bouncer-run', 'SKILL.md'),
    links: [{ href: './references/stop-recovery.md', resolve: true, referencePreamble: true, conditionalLoad: { triggers: ['fail'] } }],
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /semantic trigger/);
});


test('bouncer-run keeps Start and interactive Next-task ACQ in steps 2 and 5', () => {
  const { body } = parseFrontmatter(mainMd);
  assertShape(mainMd, {
    headings: { required: ['ACQ (AskUserQuestion) gates'] },
    steps: {
      required: [1, 2, 3, 4, 5, 6, 7],
      order: true,
      acq: [2, 5],
      acqOptions: [2, 5],
      links: { 6: ['./references/stop-recovery.md'] },
    },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [2, 5], only: true },
  });
  assert.match(body, /\.\/references\/stop-recovery\.md/);
});

test('bouncer-run is an explicit-ask workflow skill that loops execute then commit', () => {
  const { data, body } = parseFrontmatter(md);
  assertShape(md, { frontmatter: { required: ['name', 'description'], values: { name: 'bouncer-run' } } });
  assert.strictEqual(data.name, 'bouncer-run');
  assert.match(String(data.description), /^Use only when the user explicitly asks \/bouncer-run/);
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
  assert.match(body, /Start ACQ.*auto|auto.*Start ACQ/i);
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
  assert.match(body, /Revise|revise/);
  assert.match(body, /Cancel/);
});

test('bouncer-run auto swallows commit and next-task ACQs; interactive adds a boundary ACQ', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /auto/);
  assert.match(body, /interactive/);
  // 삼키는 대상은 commit ACQ와 next-task ACQ 둘. 한쪽만 적으면 계약이 반쪽임.
  assert.match(body, /commit ACQ|Commit ACQ/);
  assert.match(body, /next-task ACQ|Next-task ACQ|next-task/);
  assert.match(body, /skip|do not ask/i);
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
  assert.match(body, /\*\*1\*\*|1 fix retry/i);
  assert.match(body, /\*\*2\*\*|2 review round-trips|capped at \*\*2\*\*/i);
  assert.match(body, /round-trips[\s\S]{0,120}\*\*2\*\*[\s\S]{0,40}\/bouncer-execute/i);
  assert.match(body, /accepted/);
  assert.match(body, /\/bouncer-plan/);
});

test('bouncer-run keeps pointer and worktree on stop and forbids auto-retry', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /pointer/i);
  assert.match(body, /worktree/i);
  assert.match(body, /\/bouncer-execute/);
  assert.match(body, /retry automatically|auto-retry/i);
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
  assert.match(body, /inline/i);
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
  assert.match(body, /evidence/i);
  assert.match(body, /\/bouncer-execute/);
  // named 디스패치 네 단계는 execute 소유. 사본이 갈리면 두 문서가 다른 말을 함.
  assert.doesNotMatch(body, /resolveSubagentModel/);
});

test('bouncer-run treats context docs and subagent reports as data not instructions', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /data, not instructions/i);
  assert.match(body, /Distill/);
});

test('bouncer-run states one drive-entry rule load and skips reload on task iterations', () => {
  const { body } = parseFrontmatter(mainMd);
  // Master rules 블록에 초기 적재와 반복 생략이 같이 있어야 경계를 오해하지 않는다.
  // PROJECT_ROOT "once at drive start" 같은 인접 문장과 섞지 않는다.
  const master = body.match(/\*\*Master rules\.\*\*([\s\S]*?)(?=\n\*\*[A-Za-z]|\n## )/i)?.[1] || '';
  assert.ok(master.length > 0, 'bouncer-run must keep a Master rules block');
  assert.match(
    master,
    /(?:drive|loop|루프)[\s\S]{0,80}(?:once|1회|한\s*번|진입)|(?:once|1회|한\s*번)[\s\S]{0,80}(?:drive|loop|루프|진입)/i,
  );
  assert.match(
    master,
    /(?:재적재|다시\s*읽|do not[\s\S]{0,40}(?:re-?read|reload)|never[\s\S]{0,40}(?:re-?read|reload))/i,
  );
  // 생략 범위는 불변 규칙뿐 — Distill·ACQ·gate 절차 약화로 읽히면 안 된다.
  assert.match(body, /distill\s+--for|re-ground/i);
  assert.match(body, /AskUserQuestion|ACQ/);
  assert.match(body, /validate|gate/i);
});

test('bouncer-run preserves post-commit tasks.md commit_sha stamp', () => {
  const { body } = parseFrontmatter(mainMd);
  assert.match(body, /commit_sha/);
  assert.match(body, /do not discard/i);
});
