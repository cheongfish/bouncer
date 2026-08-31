'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const agentsDir = path.join(root, 'agents');

// 네 named agent — 골격·frontmatter 단언이 공유하는 이름 목록.
const AGENTS = [
  'bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger',
  'bouncer-context-reviewer',
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

test('agents describe task bundle briefs and task-local evidence documents', () => {
  for (const name of ['bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger']) {
    const md = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    assert.match(md, /tasks\/<NNN>\/tasks\.md/);
  }
  for (const name of ['bouncer-reviewer', 'bouncer-debugger']) {
    const md = fs.readFileSync(path.join(agentsDir, `${name}.md`), 'utf8');
    assert.match(md, /task directory.*review\.md|review\.md.*task directory/i);
  }
});

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

test('bouncer-implementer points comment rule at hard rule 9 without restating it', () => {
  const md = fs.readFileSync(path.join(agentsDir, 'bouncer-implementer.md'), 'utf8');
  assert.match(md, /Detailed comments/i);
  assert.match(md, /[Hh]ard rule 9|하드룰 9/);
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
