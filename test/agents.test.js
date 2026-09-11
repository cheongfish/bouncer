'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const agentsDir = path.join(root, 'agents');

// 네 named agent — 골격·frontmatter 단언이 공유하는 이름 목록.
const AGENTS = [
  'bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger',
  'bouncer-context-reviewer', 'bouncer-coordinator',
];
const READONLY = ['bouncer-reviewer', 'bouncer-debugger', 'bouncer-context-reviewer'];

// context-reviewer는 execute 삼인조와 같이 inherit 슬롯·readonly를 쓰지만,
// 판정 대상이 계획 문서 전체이고 산출은 BP 루트 context-review.md라
// tasks/<NNN>/tasks.md 단독 브리프·task-dir review.md 단언 순회에는 넣지 않는다.
for (const name of AGENTS) {
  test(`agents/${name}.md exists with name == basename and model inherit`, () => {
    const filePath = path.join(agentsDir, `${name}.md`);
    assert.ok(fs.existsSync(filePath), `missing ${filePath}`);
    const md = fs.readFileSync(filePath, 'utf8');
    const { data } = parseFrontmatter(md);
    assert.strictEqual(data.name, name);
    assert.strictEqual(data.model, 'inherit');
    if (
      name === 'bouncer-reviewer'
      || name === 'bouncer-debugger'
      || name === 'bouncer-context-reviewer'
    ) {
      assert.strictEqual(data.readonly, true);
    }
  });
}

test('bouncer-context-reviewer records into blueprint-root context-review.md', () => {
  const md = fs.readFileSync(
    path.join(agentsDir, 'bouncer-context-reviewer.md'),
    'utf8',
  );
  assert.match(md, /context-review\.md/);
});

// 컨트롤러(특히 /bouncer-run 루프)는 diff를 다시 읽지 않고 이 필드로만 라우팅한다.
test('bouncer-implementer applies debugger report as evidence on verify-failure re-dispatch', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  assert.match(md, /Verify-failure re-dispatch/);
  assert.match(md, /Minimum fix proposal/);
  assert.match(md, /Required regression test/);
  assert.match(md, /evidence/);
  assert.match(md, /Needs planning/);
});

test('bouncer-implementer points comment rule at hard rule 3 without restating it', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  assert.match(md, /Detailed comments/i);
  assert.match(md, /[Hh]ard rule 3|하드룰 3/);
  assert.match(md, /references\/implementation\/index\.md|CLAUDE\.md/);
  // Rule body lives in master rules + implementation skill — no second copy.
  assert.doesNotMatch(md, /known ceilings/);
  assert.doesNotMatch(md, /Prefer thoroughness/);
});

// 최소성 사다리의 정본은 이 agent 문서다(스킬에서 옮겨옴).
test('implementation climbs a minimality ladder before writing code', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  assert.match(md, /decision ladder|Understand, then climb/i);
  assert.match(md, /[Rr]euse|Already in this codebase/);
  assert.match(md, /[Ss]tandard library|stdlib/i);
  assert.match(md, /[Nn]ative platform/);
  assert.match(md, /[Aa]lready-installed dependency/i);
  assert.match(md, /minimum new code|minimum code/i);
  // native|installed 이접은 순서가 뒤집혀도 통과했다. climb 본문에서
  // native가 stdlib보다 앞에 있는지를 위치로 잡는다.
  const climb = md.match(/Understand, then climb[\s\S]*?(?=\n2\. \*\*Focused change)/);
  assert.ok(climb, 'implementer Procedure 1 must keep the climb ladder');
  const nativeAt = climb[0].search(/native platform/i);
  const stdlibAt = climb[0].search(/standard library/i);
  assert.ok(nativeAt >= 0 && stdlibAt >= 0, 'climb ladder must name both rungs');
  assert.ok(
    nativeAt < stdlibAt,
    'native platform rung must precede standard library on the implement path',
  );
  assert.match(md, /YAGNI is absent on the implement path[^\n]*on purpose/i);
  // 사다리 전용 탈출구: 승인된 체크리스트 항목을 사다리 근거로 버리려 할 때의
  // escalate 문장을 직접 겨눈다. 맨 "planning"은 Output contract의
  // "Needs planning"에도 걸려서 사다리를 지워도 통과했다.
  assert.match(md, /dropping an approved checklist item[\s\S]{0,80}escalate/i);
  assert.match(md, /do not shrink the brief in code/i);
});

// 조사 4단계의 Gate 정본은 이 agent 문서다(skills/debugging Steps에서 옮겨옴).
// 스킬 쪽 doesNotMatch까지 함께 봐야 '복사가 아니라 이동'이 지켜졌음을 보장한다.
test('debugging forbids proposing fixes before root-cause investigation', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-debugger.md'), 'utf8');
  assert.match(md, /do not propose fixes before root-cause investigation/i);
  const skill = fs.readFileSync(path.join(root, 'references/debugging/index.md'), 'utf8');
  assert.doesNotMatch(skill, /do not propose fixes before root-cause investigation/i);
});

// review 판정 기준의 정본은 이 agent 문서다(스킬 Step 3에서 옮겨옴).
test('bouncer-reviewer owns the full judging rubric', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-reviewer.md'), 'utf8');
  assert.match(md, /Spec compliance/i);
  assert.match(md, /Missing/);
  assert.match(md, /Extra/);
  assert.match(md, /Misunderstood/);
  assert.match(md, /Code quality/i);
  assert.match(md, /Calibration/i);
  assert.match(md, /Over-engineering/i);
  assert.match(md, /unrequested abstraction|stdlib|root-cause/i);
  assert.match(md, /why-comments|explanatory comments|\bwhy\b/i);
});

// Do not touch(경로)와 Constraints(그 외)를 가르는 문장, Interface의 거부 절반.
test('bouncer-reviewer judges Constraints and the rejection half of Interface', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-reviewer.md'), 'utf8');
  assert.match(md, /Constraint breach/i);
  assert.match(md, /rejects/i);
});

// severity를 보고 필터로 쓰면 nit이 통째로 사라져서 컨트롤러가 처분할 대상이
// 없어진다. 필터링은 보고 뒤에 컨트롤러가 한다는 문장을 직접 겨눈다.
test('bouncer-reviewer treats severity as a label, not a reporting filter', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-reviewer.md'), 'utf8');
  assert.match(md, /label, not a filter/i);
  assert.match(md, /[Nn]ever withhold a finding/);
});

test('bouncer-reviewer reports previous-finding relations and all actionable findings', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-reviewer.md'), 'utf8');
  assert.match(md, /\bnew\b[\s\S]{0,40}\bresolved\b[\s\S]{0,40}\bregressed\b/);
  assert.match(md, /stable[\s\S]{0,40}id|id[\s\S]{0,40}reuse/i);
  assert.match(md, /actionable finding/i);
  const prompt = fs.readFileSync(
    path.join(root, 'references/review/assets/reviewer-prompt.md'),
    'utf8',
  );
  assert.match(prompt, /Previous findings/);
  assert.match(prompt, /Resolution/);
  assert.match(prompt, /Revision diff/);
  assert.match(prompt, /Latest verification/);
});

test('bouncer-reviewer separates discovery perspectives from delta certification', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-reviewer.md'), 'utf8');
  const prompt = fs.readFileSync(
    path.join(root, 'references/review/assets/reviewer-prompt.md'),
    'utf8',
  );
  const { mdToCodexToml } = require('../scripts/lib/codex-agents');

  for (const placeholder of ['{{MODE}}', '{{PERSPECTIVE}}', '{{TARGET}}']) {
    assert.ok(prompt.includes(placeholder), `reviewer prompt must include ${placeholder}`);
  }
  for (const perspective of [
    'spec_scope',
    'correctness_tests',
    'minimality_maintainability',
    'security',
  ]) {
    assert.match(md, new RegExp(`\\b${perspective}\\b`));
  }
  assert.match(md, /introduced_by_revision/);
  assert.match(md, /missed_critical/);
  assert.match(md, /origin/);

  const tomlPath = path.join(root, '.codex/agents/bouncer-reviewer.toml');
  assert.strictEqual(fs.readFileSync(tomlPath, 'utf8'), mdToCodexToml(md));
});

// 네 판정 scope의 본문 정본은 이 agent 문서다(skills/context-review Step 3에서 옮겨옴).
// 스킬 쪽 doesNotMatch까지 함께 봐야 '복사가 아니라 이동'이 지켜졌음을 보장한다.
const contextReviewSkill = () =>
  fs.readFileSync(path.join(root, 'references/context-review/index.md'), 'utf8');
const contextReviewerAgent = () =>
  fs.readFileSync(path.join(agentsDir, 'bouncer-context-reviewer.md'), 'utf8');

test('context-review covers the four judgment scopes', () => {
  const md = contextReviewerAgent();
  const skill = contextReviewSkill();
  // scope 이름만이 아니라 각 scope의 판정 문장을 겨눈다 — 이름은 스킬에도
  // 남으므로 이름만 보면 이동 여부를 구별하지 못한다.
  assert.match(md, /Cross-document contradiction/);
  assert.match(md, /Walk epic → blueprint → tasks/);
  assert.match(md, /Scope review/);
  assert.match(md, /scope_evidence\.suggested_paths/);
  assert.match(md, /scope_evidence\.quality|quality/);
  assert.match(md, /candidates/);
  assert.match(md, /absence or empty[\s\S]{0,60}state, not a failure/i);
  assert.match(md, /do not (?:widen|expand|treat[\s\S]{0,40}authority)|advisory/i);
  assert.match(md, /Korean quality/);
  assert.match(md, /stop-slop/);
  assert.match(md, /Identifiers, paths, and fenced/);
  assert.match(md, /Verifiability of success criteria/);
  assert.match(md, /cannot be judged true or false/i);
  assert.match(md, /say yes or no from a command/);
  assert.doesNotMatch(skill, /Walk epic → blueprint → tasks/);
  assert.doesNotMatch(skill, /scope_evidence\.suggested_paths/);
  assert.doesNotMatch(skill, /stop-slop/);
  assert.doesNotMatch(skill, /cannot be judged true or false/i);
});

test('context-review excludes OKF fields and status that gates already check', () => {
  const md = contextReviewerAgent();
  assert.match(md, /OKF/i);
  assert.match(md, /exclud|out of (scope|judgment)|gates already/i);
  assert.match(md, /re-litigate G1/);
  assert.doesNotMatch(contextReviewSkill(), /OKF/i);
});

test('context-review judges Mermaid zoom conflicts without requiring a chart', () => {
  const md = contextReviewerAgent();
  assert.match(md, /mermaid/i);
  assert.match(md, /zoom/i);
  assert.match(md, /Chart absence is optional and not a finding/i);
  // Mermaid는 다섯 번째 scope가 아니라 Cross-document의 하위 항목이다.
  assert.match(md, /not a fifth judgment scope/i);
  assert.doesNotMatch(contextReviewSkill(), /mermaid/i);
});

// bouncer-reviewer와 같은 이유로 context reviewer도 severity를 필터로 쓰면 안 된다.
// 이 문장은 스킬 Calibration에서 옮겨온 것이라, 스킬 쪽 doesNotMatch까지 함께 본다.
test('bouncer-context-reviewer treats severity as a label, not a reporting filter', () => {
  const md = contextReviewerAgent();
  assert.match(md, /label, not a filter/i);
  assert.match(md, /report every real issue/i);
  assert.doesNotMatch(contextReviewSkill(), /label, not a filter/i);
  assert.doesNotMatch(contextReviewSkill(), /report every real issue/i);
});

// coordinator는 /bouncer-run이 drive 권한을 넘긴 controller다. 이 네 절이
// 빠지면 위임받은 쪽이 어디까지 결정할 수 있는지가 문서에 남지 않는다.
test('bouncer-coordinator owns delegated drive authority and worker dispatch', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  assert.match(md, /\/bouncer-run/);
  assert.match(md, /start ACQ|start approval/i);
  assert.match(md, /bouncer coordinate/);
  assert.match(md, /coordinator\.json/);
  for (const worker of ['bouncer-implementer', 'bouncer-debugger', 'bouncer-reviewer']) {
    assert.match(md, new RegExp(worker), `coordinator must dispatch ${worker}`);
  }
  assert.match(md, /rules\/subagent-model\.md/);
  // worker 보고는 판정 입력이지 두 번째 브리프가 아니다.
  assert.match(md, /never a second brief|not a second brief/i);
});

test('bouncer-coordinator refuses main-worktree writes and nested coordinators', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  assert.match(md, /integration worktree/i);
  assert.match(md, /task worktree/i);
  assert.match(md, /main worktree[\s\S]{0,120}(?:refuse|reject)|(?:refuse|reject)[\s\S]{0,120}main worktree/i);
  assert.match(md, /read-only provenance/i);
  assert.match(md, /(?:do not|never)[\s\S]{0,80}another coordinator|one coordinator per drive/i);
});

// 포인터는 Git common dir에 하나뿐이라 worker마다 생기지 않는다. 누가 언제
// --set 하는지가 문서에 없으면 위임받은 쪽은 current가 null인 worktree에서
// execute를 시작한다.
test('bouncer-coordinator owns the shared pointer before driving a task', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  assert.match(md, /bouncer\n?\s*current --set/);
  assert.match(md, /Git common directory/);
  assert.match(md, /no per-worker pointer|same one/i);
  assert.match(md, /never let a worker move it|workers never move/i);
});

// drift는 이제 드라이브 정지가 아니라 기록이다. 기록 수단(CLI 한 표면)과
// 경계(.bouncer/.git/절대경로 금지, 그 안에서는 상한 없음)를 함께 못 박는다.
test('bouncer-coordinator records scope drift with coordinate revise', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  assert.match(md, /bouncer coordinate\s*\n?\s*revise/);
  assert.match(md, /--paths <p> \[--paths <p>…\]/);
  assert.match(md, /--reason <r>/);
  assert.match(md, /only surface that revises\s*\n?\s*scope/i);
  assert.match(md, /one revision/);
  assert.match(md, /no ceiling/);
  assert.match(md, /`\.bouncer\/` governance tree/);
  // 계획 후퇴 문구와 옛 상한 문구는 저장소에서 사라져야 한다.
  assert.doesNotMatch(md, /[Dd]o not widen `affected_paths`/);
  assert.doesNotMatch(md, /scope ceiling/);
  // 훅은 호스트 로드에 의존하고 CLI 가드만 모든 호스트에 있다.
  assert.match(md, /commit scope\s*\n?\s*guard/);
  assert.match(md, /`bouncer commit`\)/);
  assert.match(md, /`commit-safety` where the host loads the hook/);
});

// 세 worker는 역할을 그대로 유지하되, coordinator가 판정할 재료를 같은
// 이름의 필드로 돌려줘야 한다. 이름이 갈라지면 coordinator가 보고를 다시 읽는다.
test('every worker reports scope and task impact back to the controller', () => {
  for (const name of ['bouncer-implementer', 'bouncer-debugger', 'bouncer-reviewer']) {
    const md = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    assert.match(md, /Scope\/task impact|Scope impact/, `${name} must report scope impact`);
    assert.match(md, /controller/i, `${name} must hand the judgment to the controller`);
  }
});

// worker는 자기 worktree 밖을 건드리지 않는다. 이 문장이 없으면 병렬 wave에서
// 한 worker가 다른 task의 checkout이나 main을 고칠 수 있다.
test('every worker is bounded to the worktree the controller assigned', () => {
  for (const name of ['bouncer-implementer', 'bouncer-debugger', 'bouncer-reviewer']) {
    const md = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    assert.match(md, /worktree the controller gave you as cwd/, name);
  }
  const impl = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  assert.match(impl, /one worktree per task/);
  assert.match(impl, /main checkout are never yours to edit/);
});

// 두 read-only worker는 계속 읽기 전용이다.
test('debugger and reviewer stay read-only under coordinator dispatch', () => {
  for (const name of ['bouncer-debugger', 'bouncer-reviewer']) {
    const md = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    assert.match(md, /Do \*\*not\*\* modify the working tree/, name);
  }
});

// worker의 Needs planning은 coordinator의 Decision required가 된다.
// 드라이브 중 /bouncer-plan 복귀를 남겨 두면 실행이 다시 끊긴다.
test('implementer routes Needs planning to a controller decision, not a plan retreat', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  assert.match(md, /Decision\s*\n?required/);
  assert.doesNotMatch(md, /Send the user back to\s*\n?\s*`\/bouncer-plan`/);
  assert.doesNotMatch(md, /escalates to `\/bouncer-plan` from that field/);
});

// ready wave는 여러 task를 열지만 포인터는 저장소에 하나다. 이 제약을 적지
// 않으면 위임받은 쪽이 병렬 execute를 시도한다.
test('bouncer-coordinator records what the shared pointer lets a wave overlap', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  assert.match(md, /ready wave overlaps only its worktree\s*\n?\s*preparation/i);
  assert.match(md, /parallel_safe/);
  assert.match(md, /drive them one at a time/);
  assert.match(md, /each `--set` replaces the previous/);
});

// finalize의 동의 단계는 사용자 것이다. coordinator가 ACQ를 못 여는데
// finalize를 끝까지 돌리라고 하면 두 문서가 서로를 부정한다.
test('bouncer-coordinator stops the closing action at the first consent step', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  const close = md.match(/6\. \*\*Close\*\*[\s\S]*?(?=\n\n)/)?.[0] || '';
  assert.match(close, /without user consent/);
  assert.match(close, /stop at the first one you\s*\n?\s*reach/);
  assert.match(close, /Do not answer, skip, or pre-empt/);
  assert.match(md, /Never answer another workflow's consent step/);
  const contract = md.slice(md.indexOf('## Output contract'));
  assert.match(contract, /consent step it stopped/);
});

// record는 sha와 decision만 저장한다. ledger가 경로를 따로 받는 것처럼 쓰면
// 문서가 CLI 계약보다 앞서간다.
test('bouncer-coordinator keeps provenance inside the recorded decision', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  assert.match(md, /provenance[\s\S]{0,120}inside[\s\S]{0,20}the decision/i);
  assert.doesNotMatch(md, /`bouncer coordinate record` its result SHA, actual paths/);
});

test('bouncer-coordinator bounds terminal CI repair and preserves partial-close evidence', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  assert.match(md, /two repair waves/i);
  assert.match(md, /NEXT_PLAN\.md/);
  assert.match(md, /user confirmation/i);
  assert.match(md, /partial_closed/);
  const outcome = md.slice(md.indexOf('- **Outcome**'), md.indexOf('- **Completed**'));
  assert.match(outcome, /completed.*blocked.*partial_closed/i);
  assert.match(outcome, /exactly one/i);
});

test('bouncer-coordinator names its closing action', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  const close = md.match(/6\. \*\*Close\*\*[\s\S]*?(?=\n\n)/)?.[0] || '';
  assert.match(close, /\/bouncer-finalize/);
  assert.match(close, /integration\s*\n?\s*worktree/i);
});

// autonomy를 payload에 넣고 효과가 없다고 쓰면 interactive가 조용히 사라진다.
test('bouncer-coordinator gives autonomy a stated reporting effect', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  assert.match(md, /`interactive` returns a progress line/);
  assert.match(md, /`auto` batches/);
  assert.match(md, /Neither value opens\s*\n?\s*an ACQ/);
});

test('bouncer-coordinator reports progress, blocked, and completed outcomes', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  const contract = md.slice(md.indexOf('## Output contract'));
  assert.match(contract, /Progress/);
  assert.match(contract, /blocked/i);
  assert.match(contract, /completed/i);
  assert.match(contract, /Decision/);
  assert.match(contract, /rules\/output\.md/);
});

test('checked-in coordinator TOML matches mdToCodexToml byte-for-byte', () => {
  const { mdToCodexToml, GENERATED_MARKER } = require('../scripts/lib/codex-agents');
  const markdown = fs.readFileSync(path.join(agentsDir, 'bouncer-coordinator.md'), 'utf8');
  const generated = mdToCodexToml(markdown);
  const checkedIn = fs.readFileSync(
    path.join(root, '.codex/agents/bouncer-coordinator.toml'), 'utf8',
  );

  assert.strictEqual(checkedIn.split(/\r?\n/, 1)[0], GENERATED_MARKER);
  assert.strictEqual(checkedIn, generated);
  // named agent가 없는 host의 fallback은 이 본문을 그대로 넘겨야 같은 역할이 된다.
  for (const heading of ['## Authority', '## Hard guards', '## Procedure', '## Output contract']) {
    assert.ok(generated.includes(heading), `generated TOML must retain ${heading}`);
  }
});

test('agent docs share the body skeleton and end with the output contract', () => {
  for (const name of AGENTS) {
    const md = fs.readFileSync(path.join(root, 'agents', `${name}.md`), 'utf8');
    const heads = [...md.matchAll(/^## .*$/gm)].map((m) => m[0]);
    assert.strictEqual(heads[0], '## Authority', name);
    // 가드 절은 권한 바로 뒤. 도메인 절(Scope, Rubric 등)은 그 아래로 간다.
    const guard = READONLY.includes(name) ? '## Hard guards (read-only)' : '## Hard guards';
    assert.strictEqual(heads[1], guard, name);
    assert.ok(heads.includes('## Procedure') || READONLY.includes(name), name);
    assert.strictEqual(heads[heads.length - 1], '## Output contract', name);
  }
});

test('agent doc bodies use English headings', () => {
  for (const name of AGENTS) {
    const md = fs.readFileSync(path.join(root, 'agents', `${name}.md`), 'utf8');
    const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
    assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
  }
});

test('mdToCodexToml preserves name description body and readonly sandbox', () => {
  const { mdToCodexToml, GENERATED_MARKER } = require('../scripts/lib/codex-agents');
  for (const name of AGENTS) {
    const md = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    const { data, body } = parseFrontmatter(md);
    const toml = mdToCodexToml(md);
    assert.ok(toml.startsWith(GENERATED_MARKER), name);
    assert.match(toml, new RegExp(`name = "${name}"`));
    assert.ok(toml.includes(`description = ${JSON.stringify(data.description)}`), name);
    assert.match(toml, /developer_instructions = """/);
    assert.ok(toml.includes(body.trim().slice(0, 40)), name);
    if (READONLY.includes(name)) {
      assert.match(toml, /sandbox_mode = "read-only"/);
    } else {
      assert.doesNotMatch(toml, /sandbox_mode/);
    }
    assert.doesNotMatch(toml, /^model\s*=/m);
  }
});

test('mdToCodexToml keeps the implementer role contract intact', () => {
  const { mdToCodexToml } = require('../scripts/lib/codex-agents');
  const markdown = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  const toml = mdToCodexToml(markdown);

  // 축약 dispatch는 생성 TOML의 역할 지시를 전제하므로, 경계 절이 하나라도
  // 빠지면 named agent가 fallback과 동등한 가드를 받는다는 전제가 무너진다.
  for (const heading of ['## Authority', '## Hard guards', '## Procedure', '## Output contract']) {
    assert.ok(toml.includes(heading), `generated TOML must retain ${heading}`);
  }
});

// 축약 named payload는 로컬 TOML이 정본 변환과 바이트 단위로 같을 때만
// 허용된다. 마커가 없거나 내용이 어긋나면 compact를 성공으로 치면 안 된다.
// 2026-09-06 측정: mdToCodexToml(agents/bouncer-implementer.md)와
// .codex/agents/bouncer-implementer.toml 은 이미 6331 bytes로 일치하므로
// 사본 재생성은 no-op이다. 불일치가 나면 init으로 다른 TOML까지 건드리지
// 말고 이 단언이 실패하게 둔다.
test('checked-in implementer TOML matches mdToCodexToml byte-for-byte', () => {
  const { mdToCodexToml, GENERATED_MARKER } = require('../scripts/lib/codex-agents');
  const markdown = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  const generated = mdToCodexToml(markdown);
  const checkedInPath = path.join(root, '.codex/agents/bouncer-implementer.toml');
  const checkedIn = fs.readFileSync(checkedInPath, 'utf8');
  const firstLine = checkedIn.split(/\r?\n/, 1)[0];

  assert.strictEqual(firstLine, GENERATED_MARKER);
  assert.strictEqual(checkedIn, generated);
});

test('an unmarked implementer TOML remains user-owned and requires the full fallback', () => {
  const { ensureCodexAgents } = require('../scripts/lib/codex-agents');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-agents-'));
  const rel = '.codex/agents/bouncer-implementer.toml';
  const owned = 'name = "my-implementer"\n';

  try {
    fs.mkdirSync(path.join(repo, '.codex/agents'), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), owned);
    ensureCodexAgents({ repoRoot: repo, created: [], agentsDir });

    // 마커 없는 TOML은 사용자가 관리한다. 따라서 named dispatch가 역할 문서를
    // 전제로 input을 줄이면 안 되고, fallback의 전체 가드를 유지해야 한다.
    assert.strictEqual(fs.readFileSync(path.join(repo, rel), 'utf8'), owned);
    const dispatch = fs.readFileSync(
      path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8',
    );
    const named = dispatch.match(/## Named implementer[\s\S]*?(?=\n## )/)?.[0] || '';
    const fallback = dispatch.match(/## Implementer fallback[\s\S]*?(?=\n## |$)/)?.[0] || '';
    assert.match(named, /exact match/i);
    assert.match(fallback, /user-owned[\s\S]*do not compact/i);
    assert.match(fallback, /Authority[\s\S]*Hard guards[\s\S]*tests-first[\s\S]*comments[\s\S]*Output contract/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
