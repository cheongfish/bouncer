'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readWorkflowBundle } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const mainMd = fs.readFileSync(path.join(root, 'skills', 'bouncer-plan', 'SKILL.md'), 'utf8');
const md = readWorkflowBundle('bouncer-plan');

test('bouncer-plan conditionally routes three planning references and retains core gates', () => {
  const { body } = parseFrontmatter(mainMd);
  const routes = [
    ['distill-preflight.md', 'When preparing the Distill baseline and preflight, read this reference.'],
    ['graphify-suggestions.md', 'When generating Graphify suggestions, read this reference.'],
    [
      'context-review.md',
      'When deciding context review for a `scale: full` blueprint after `affected_paths` confirmation, '
        + 'read this reference.',
    ],
  ];
  for (const [file, condition] of routes) {
    // 스킬 로컬은 ./references/… — bare references/ 와 루트 접두를 쓰지 않는다.
    assert.match(
      body,
      new RegExp(`\\]\\(\\.\\/references\\/${file.replace(/\./g, '\\.')}\\)`),
      `${file} must be linked as ./references/${file}`,
    );
    const reference = fs.readFileSync(path.join(root, 'skills', 'bouncer-plan', 'references', file), 'utf8');
    assert.ok(reference.startsWith(condition), `${file} must declare its exact loading condition first`);
  }
  assert.match(body, /\*\*Discover\.\*\*/);
  assert.match(body, /\*\*affected_paths \(user-confirmed\)\.\*\*/);
  assert.match(body, /\*\*Approval \(explicit\)\.\*\*/);
  assert.match(body, /current\s+--set/);
  assert.match(body, /G1 epic approved[\s\S]{0,1600}G12/);
  assert.doesNotMatch(body, /bouncer graph-sync|resolveSubagentModel/);
});

/**
 * numbered step N 본문(다음 step 또는 ACQ H2 직전)을 잘라 낸다.
 *
 * @param {string} body - frontmatter 제거 본문
 * @param {number} n - step 번호
 * @returns {string}
 */
function planStepBody(body, n) {
  const start = body.search(new RegExp(`^${n}\\. \\*\\*`, 'm'));
  assert.ok(start > -1, `missing plan step ${n}`);
  const rest = body.slice(start);
  const next = rest.search(new RegExp(`\\n(?:${n + 1}\\. \\*\\*|## ACQ )`, 'm'));
  return next === -1 ? rest : rest.slice(0, next);
}

test('bouncer-plan places discovery/ID/verify/scope/approval ACQ in numbered steps', () => {
  const { body } = parseFrontmatter(mainMd);
  const acqAt = body.indexOf('\n## ACQ (AskUserQuestion) gates\n');
  assert.ok(acqAt > -1);
  const index = body.slice(acqAt);
  // 색인은 step 연결만 — Options 본문은 두지 않는다.
  assert.doesNotMatch(index, /\*\*Options\*\*:/);
  assert.match(index, /[Ss]tep\s+1/);
  assert.match(index, /[Ss]tep\s+2/);
  assert.match(index, /[Ss]tep\s+4/);
  assert.match(index, /[Ss]tep\s+6/);
  assert.match(index, /[Ss]tep\s+8/);

  // 질문 설명은 해당 step에 있다 (H2 위치가 아니라 numbered step 연결).
  assert.match(planStepBody(body, 1), /[Cc]onfirm/);
  assert.match(planStepBody(body, 2), /[Aa]sk|override|light/i);
  assert.match(planStepBody(body, 4), /[Aa]sk[\s\S]{0,120}verify|verify[\s\S]{0,120}[Aa]sk/i);
  assert.match(planStepBody(body, 6), /confirm|ask/i);
  assert.match(planStepBody(body, 8), /[Aa]sk[\s\S]{0,80}approv|approv[\s\S]{0,40}[Aa]sk/i);

  // 루트 보조는 ${BOUNCER_ROOT}/references/… 만.
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/discovery\/index\.md/);
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/minimality\/index\.md/);
  assert.doesNotMatch(
    body,
    /(?<!\$\{BOUNCER_ROOT\}\/|\.\/)references\/discovery\/index\.md/,
  );
});

test('bouncer-plan wires scaffold, skills, affected_paths, pointer, and plan gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.match(body, /scripts\/bouncer"\s+scaffold\s+epic\b/);
  assert.match(body, /scripts\/bouncer"\s+scaffold\s+blueprint\b/);
  assert.match(body, /scaffold task --blueprint/);
  assert.match(body, /scripts\/bouncer"\s+validate\s+--blueprint\s+<pointer\.blueprint>\s+--gate\s+plan\b/);
  assert.match(body, /\.bouncer\/context\/epics/);
  assert.match(body, /discovery/);
  assert.match(body, /spec-authoring/);
  assert.match(body, /stop-slop/);
  assert.match(body, /graphify-runner/);
  assert.match(body, /minimality/);
  assert.match(body, /affected_paths/);
  assert.match(body, /scripts\/bouncer"\s+current\s+--set\b/);
  assert.match(body, /approv/i);
  assert.doesNotMatch(md, /superpowers|profile-aware|--from-superpowers|import-superpowers|okf-authoring/i);
});

test('bouncer-plan requires implementation-ready tasks sections and mentions G10–G12', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /Goal & intent|Interface|Touch|Do not touch|Checklist/i);
  assert.match(body, /G10|G11|G12/);
});

test('bouncer-plan gate list includes G18 context-review', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /G18/);
  assert.match(body, /context-review/);
});

test('bouncer-plan recommends minimality (advisory) and keeps graphify-runner', () => {
  assert.match(md, /minimality/);
  assert.match(md, /recommend|권장|advisory/i);
  assert.match(md, /graphify-runner/);
  assert.match(md, /unavailable|skip|fallback|manual/i);
});

test('bouncer-plan states that G4 requires a recorded graph basis', () => {
  assert.match(md, /G4[^\n]*basis|basis[^\n]*G4/);
  assert.match(md, /scaffold[^\n]*empty list|empty list[^\n]*basis/i);
});

test('bouncer-plan shows role candidates and quality before affected_paths confirm', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /candidates|role/i);
  assert.match(body, /quality|reasons|low-confidence|confidence/i);
  assert.match(body, /affected_paths/);
  // 자동 승인을 금지하고 사용자 확인을 요구한다.
  assert.match(body, /confirm|ask/i);
  assert.doesNotMatch(body, /auto(?:matically)?\s+(?:copy|set|write)\s+affected_paths/i);
});

test('bouncer-plan reminds authors that titles feed the finalize commit message', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /title/i);
  assert.match(body, /commit_intent/);
  assert.match(body, /\.gitmessage|commit_type|\/bouncer-finalize/);
});


test('bouncer-plan preflight reads project Distill', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /\.bouncer\/Distill\.md/);
  assert.match(body, /Read/i);
});

test('bouncer-plan step 1 cites the named discovery handoff outputs', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /Edge cases & failure modes/);
  assert.match(body, /Overlap/);
  assert.match(body, /실패 모드|failure mode/i);
});

test('bouncer-plan requires Korean bodies and stop-slop after authoring', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /Korean/);
  assert.match(body, /stop-slop/);
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/stop-slop\/index\.md/);
});

test('bouncer-plan delegates Mermaid zoom authoring to spec-authoring', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /mermaid|zoom/i);
  assert.match(body, /spec-authoring/);
});

test('bouncer-plan detects project build scripts and asks before writing tasks verify', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /docker-compose|compose\.ya?ml/);
  assert.match(body, /Makefile/);
  assert.match(body, /package\.json/);
  assert.match(body, /bouncer\.verify|tasks\.bouncer\.verify/);
  assert.match(body, /ask/i);
});

test('bouncer-plan dispatches context-review before approval with named-agent fallback', () => {
  const { body } = parseFrontmatter(md);
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-plan/references/context-review.md'), 'utf8');
  // 루트 보조(index)와 스킬 로컬(md)은 접두가 달라 같은 문자열이 아니다.
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/context-review\/index\.md/);
  assert.match(body, /\.\/references\/context-review\.md/);
  assert.match(dispatch, /bouncer-context-reviewer/);
  assert.match(dispatch, /rules\/subagent-model\.md/);
  // named agent를 로드하지 못하면 단계를 건너뛰지 않고 인라인한다.
  assert.match(dispatch, /context-review.*inline|generic.*read-only/i);
  const reviewAt = body.search(/context-review|bouncer-context-reviewer/);
  const approvalAt = body.search(/\*\*Approval/);
  assert.ok(reviewAt > -1 && approvalAt > reviewAt, 'context-review step must precede Approval');
});

// 경량 경로는 사용자 선언만 — 자동 판정·schema 등록 없이 산문에 고정한다.
test('bouncer-plan asks for the light path and reuses the shared maintenance epic', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /bouncer\.scale/);
  assert.match(body, /light/);
  assert.match(body, /maintenance/);
  // 사용자에게 묻는다 — 자동 판정 금지를 긍정 문구로 단언한다.
  assert.match(body, /ask/i);
  assert.match(body, /do not auto-judge|declar/i);
});

// light 분기: scaffold 플래그와 context-review 생략을 산문에 고정한다.
test('bouncer-plan scaffolds a light blueprint with --scale light', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /--scale light/);
  assert.match(body, /--scale full|light\|full|`light`\/`full`/);
  // 선언 없이 추측으로 붙이지 않는다.
  assert.match(body, /guess|no declaration|do not auto-judge/i);
});

test('bouncer-plan skips the context-review step on scale light', () => {
  const { body } = parseFrontmatter(md);
  const step = body.slice(body.indexOf('7. **Context review.**'), body.indexOf('8. **Approval'));
  assert.match(step, /light/);
  assert.match(step, /[Ss]kip/);
  assert.match(step, /G18/);
  // 대체 판정을 세우지 말 것.
  assert.match(step, /do not substitute|not substitute/i);
});

test('bouncer-plan states the light G10 section list and the unchanged scope gates', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /Goal & intent, Touch, Checklist/);
  assert.match(body, /G4·G5·G11·G12|G4[^\n]*G12/);
});

// 프리플라이트 --all 직후 총량은 한 줄만 — 샤드별 표는 세션 주입이 된다.
test('bouncer-plan reports Distill total size in one line after preflight', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /preflight[\s\S]{0,80}total size[\s\S]{0,40}one line/i);
});

// 컨텍스트에는 --preflight만. --all 전량은 스크래치 baseline 파일이고 주입이 아니다.
test('bouncer-plan injects Distill --preflight and stores --all as a scratch baseline', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /distill\s+--preflight/);
  assert.match(body, /baseline/);
  assert.match(body, /scratch|mktemp|TMPDIR/i);
  assert.doesNotMatch(body, /consume its stdout/);
  assert.doesNotMatch(body, /and use\s+the complete output/i);
  assert.match(body, /must not replace|does not replace|must not substitute/i);
});

// plan 게이트는 발견된 각 task 묶음에 G4·G5·G10–G12를 적용하므로,
// Author/Graph/affected_paths도 tasks/001만 지목하면 안 되고 전 묶음을 순회해야 한다.
test('bouncer-plan authors every task bundle, not only 001', () => {
  const { body } = parseFrontmatter(md);
  assert.doesNotMatch(body, /tasks\/001\/tasks\.md/);
  assert.match(body, /tasks\/<NNN>\/tasks\.md/);
});

// graphify 활성화는 config 손편집·pip 직접 안내가 아니라 CLI 경로만 가리킨다.
test('bouncer-plan points graphify enablement at the CLI only', () => {
  const { body } = parseFrontmatter(md);
  assert.doesNotMatch(body, /graphify\.enabled:\s*true/);
  assert.doesNotMatch(body, /pip install graphifyy/);
  assert.match(body, /init --promote-graphify/);
});
