'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../packages/cli/dist/frontmatter');
const { GENERIC_SKILLS } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const WORKFLOW = [
  'bouncer-init', 'bouncer-plan', 'bouncer-finalize', 'bouncer-run',
];
// 공개 진입에서 제거한 스킬. 파일이 다시 생기면 아래 부재 단언이 실패한다.
// bouncer-retro는 finalize의 references/retro.md로 이관되어 독립 진입점이 없다.
const RETIRED = ['bouncer-execute', 'bouncer-commit', 'bouncer-retro'];
// Subskills live at references/<name>/index.md (not the host skills/ catalog).
const UNPUBLISHED = [
  'discovery', 'spec-authoring', 'stop-slop', 'graphify-runner', 'minimality',
  'context-review', 'implementation', 'verification', 'debugging', 'review',
  'explain-diff',
];
// 호스트 카탈로그는 워크플로 넷뿐이다(102-001에서 execute·commit, 이후 retro 제거). 폐기한 agentic-code-benchmark를 다시 넣지 않는다.
const EXPECTED_SKILL_COUNT = 4;

/**
 * `skills/` 아래 SKILL.md가 있는 디렉터리 이름을 정렬해 돌려준다.
 * 정본 개수는 이 목록 길이라서, 새 스킬을 추가하면 상수를 따라 올리지 않고
 * 테스트가 실패해야 한다.
 *
 * @returns {string[]} 정렬된 스킬 디렉터리 이름
 */
function listCanonicalSkillNames() {
  const skillsRoot = path.join(root, 'skills');
  return fs.readdirSync(skillsRoot)
    .filter((name) => {
      const dir = path.join(skillsRoot, name);
      return fs.statSync(dir).isDirectory()
        && fs.existsSync(path.join(dir, 'SKILL.md'));
    })
    .sort();
}

function readWorkflow(name) {
  return fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
}

test('workflow skills → retain an entry procedure and the ACQ index', () => {
  for (const name of WORKFLOW) {
    const md = readWorkflow(name);
    assert.match(md, /^1\. /m, `${name}: missing first procedure step`);
    assert.match(md, /^## ACQ \(AskUserQuestion\) gates$/m, `${name}: missing ACQ index`);
  }
});

/**
 * 번호 매긴 절차 1단계 앞의 본문. 기본 경로가 항상 읽는 구간이라
 * 조건부 helper cite가 여기 있으면 실패 전용·advisory 절차까지 선적재한다.
 *
 * @param {string} md - SKILL.md 원문
 * @returns {string} `1. ` 이전 본문
 */
function numberedProcedurePreamble(md) {
  const match = md.match(/^1\. /m);
  assert.ok(match, 'missing numbered step 1');
  return md.slice(0, match.index);
}

test('entry Master rules → load only the shared runtime contract', () => {
  const productRules = [
    'rules/commit-scope.md',
    'rules/planning.md',
    'rules/document-schema.md',
    'rules/current-pointer.md',
    'rules/output.md',
    'rules/subagent-model.md',
  ];
  for (const name of WORKFLOW) {
    const master = readWorkflow(name).match(/\*\*Master rules\.\*\*[\s\S]*?(?=\n\n)/)?.[0];
    assert.ok(master, `${name}: missing Master rules block`);
    assert.match(master, /AGENTS\.md/, `${name}: runtime contract must load first`);
    for (const rule of productRules) {
      assert.doesNotMatch(master, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `${name}: ${rule} belongs to its owning numbered step`);
    }
  }
});

// 기본 성공 경로가 아닌 helper. 소유는 해당 numbered step 또는 skill-local reference.
const CONDITIONAL_HELPERS = {
  'bouncer-init': { root: [], local: ['init-result.md'] },
  'bouncer-plan': {
    root: ['minimality/index.md', 'context-review/index.md'],
    local: ['context-review.md', 'scope-confirm.md', 'evidence-dispatch.md'],
  },
  'bouncer-run': { root: [], local: [] },
  'bouncer-finalize': {
    root: [],
    local: ['distill-promotion.md', 'explain-quiz.md', 'draft-pr.md', 'cleanup-handoff.md', 'remainder.md', 'retro.md'],
  },
};

test('entry skills → do not load conditional helpers before numbered steps', () => {
  for (const name of WORKFLOW) {
    const preamble = numberedProcedurePreamble(readWorkflow(name));
    const { root, local } = CONDITIONAL_HELPERS[name];
    for (const helper of root) {
      assert.doesNotMatch(
        preamble,
        new RegExp(helper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `${name}: ${helper} is owned by a later conditional step`,
      );
    }
    for (const file of local) {
      assert.doesNotMatch(
        preamble,
        new RegExp(`\\./references/${file.replace(/\./g, '\\.')}`),
        `${name}: ./references/${file} is owned by a later conditional step`,
      );
    }
  }
});

test('workflow skills → use directory-matching names and explicit-invocation descriptions', () => {
  for (const name of WORKFLOW) {
    const { data } = parseFrontmatter(readWorkflow(name));
    assert.strictEqual(data.name, name);
    // 명시 호출 전용: /<skill-name> 직접 요청에서만 선택되고 핵심 산출물을 한 문장에 둔다.
    assert.match(String(data.description), /^Use only when the user explicitly asks \//);
    assert.match(String(data.description), new RegExp(`/${name}(?:\\b|[^a-z-]|$)`));
  }
});

/**
 * SKILL.md 본문에서 접두 없는 references/… 인용을 모은다.
 * ${BOUNCER_ROOT}/ 와 ./ 접두만 허용 — 같은 bare 문자열이 루트·로컬을
 * 동시에 가리키는 모호성을 구조적으로 막는다.
 *
 * @param {string} md - SKILL.md 원문
 * @returns {string[]} bare 경로 목록
 */
function bareReferenceCites(md) {
  return [...md.matchAll(/(?<!\$\{BOUNCER_ROOT\}\/|\.\/)references\/[A-Za-z0-9._/-]+/g)]
    .map((m) => m[0]);
}

/** @type {Record<string, string[]>} 스킬 로컬 references/*.md 파일명 */
const SKILL_LOCAL_REFS = {
  'bouncer-init': ['init-result.md'],
  'bouncer-plan': [
    'context-review.md',
    'scope-confirm.md',
    'evidence-dispatch.md',
  ],
  'bouncer-finalize': [
    'explain-quiz.md',
    'remainder.md',
    'draft-pr.md',
    'cleanup-handoff.md',
    'retro.md',
  ],
  'bouncer-run': ['direct-run.md'],
};

// 폐기한 두 진입 스킬은 파일이 없어야 하고, 이관된 reference는 run 아래에 남아 있어야 한다.
const RUN_OWNED_REFS = ['agent-dispatch.md', 'verification-recovery.md', 'review-round.md'];

test('retired entry skills → files are gone and run keeps the migrated references', () => {
  for (const name of RETIRED) {
    assert.equal(fs.existsSync(path.join(root, 'skills', name)), false, `${name} must stay removed`);
    assert.equal(listCanonicalSkillNames().includes(name), false, `${name} must not be canonical`);
  }
  for (const file of RUN_OWNED_REFS) {
    assert.ok(fs.existsSync(path.join(root, 'skills', 'bouncer-run', 'references', file)), `run ${file} must exist`);
  }
});

test('workflow skills → classify references as root or skill-local without bare collision', () => {
  for (const name of WORKFLOW) {
    const md = readWorkflow(name);
    const bare = bareReferenceCites(md);
    assert.deepStrictEqual(
      bare,
      [],
      `${name}: bare references/ cites must use \${BOUNCER_ROOT}/ or ./ prefix; found ${bare.join(', ')}`,
    );

    const local = SKILL_LOCAL_REFS[name];
    for (const file of local) {
      assert.ok(
        fs.existsSync(path.join(root, 'skills', name, 'references', file)),
        `${name}: missing skill-local ${file}`,
      );
      assert.match(
        md,
        new RegExp(`\\./references/${file.replace(/\./g, '\\.')}`),
        `${name}: skill-local ${file} must be cited as ./references/${file}`,
      );
      // 로컬 파일을 루트 접두로 쓰면 존재하지 않는 경로를 가리킨다.
      assert.doesNotMatch(
        md,
        new RegExp(`\\$\\{BOUNCER_ROOT\\}/references/${file.replace(/\./g, '\\.')}`),
        `${name}: must not prefix skill-local ${file} with \${BOUNCER_ROOT}/`,
      );
    }

    // plan의 context-review 충돌 쌍: 본문에서 뽑은 두 cite 문자열이 달라야 한다.
    if (name === 'bouncer-plan') {
      const rootCite = md.match(/\$\{BOUNCER_ROOT\}\/references\/context-review\/index\.md/)?.[0];
      const localCite = md.match(/\.\/references\/context-review\.md/)?.[0];
      assert.ok(rootCite, 'bouncer-plan must cite root context-review/index.md');
      assert.ok(localCite, 'bouncer-plan must cite skill-local context-review.md');
      assert.notStrictEqual(rootCite, localCite);
    }
  }
});

test('commands/ directory → is gone', () => {
  assert.ok(!fs.existsSync(path.join(root, 'commands')));
});

test('GENERIC_SKILLS → does not list workflow skills', () => {
  for (const name of WORKFLOW) {
    assert.ok(!GENERIC_SKILLS.includes(name), name);
  }
});

/**
 * 마지막 ACQ H2 이전 절차와 이후 색인 본문을 나눈다.
 *
 * @param {string} md - SKILL.md 원문
 * @returns {{ procedure: string, index: string }}
 */
function splitAcq(md) {
  const marker = '\n## ACQ (AskUserQuestion) gates\n';
  const i = md.indexOf(marker);
  assert.ok(i > -1, 'missing ACQ H2');
  return { procedure: md.slice(0, i), index: md.slice(i + marker.length) };
}

// ACQ 색인의 형태만 본다: 질문 본문(AskUserQuestion·Options)은 번호 단계에 두고 색인은
// 단계 번호를 가리킨다.
test('workflow ACQ section → is a step index; AskUserQuestion detail stays in numbered steps', () => {
  for (const name of WORKFLOW) {
    const { index } = splitAcq(readWorkflow(name));
    assert.doesNotMatch(index, /\*\*AskUserQuestion/, `${name}: ACQ index must not embed AskUserQuestion blocks`);
    assert.doesNotMatch(index, /\*\*Options\*\*:/, `${name}: ACQ index must not embed Options lists`);
    assert.match(index, /[Ss]tep\s+\d+/, `${name}: ACQ index must cite step numbers`);
  }
});

test('unpublished helpers → live under references/ and are absent from the catalog', () => {
  const skillNames = listCanonicalSkillNames();
  for (const name of UNPUBLISHED) {
    assert.equal(skillNames.includes(name), false);
    assert.equal(fs.existsSync(path.join(root, 'references', name, 'SKILL.md')), false);
    assert.ok(fs.existsSync(path.join(root, 'references', name, 'index.md')));
  }
  assert.equal(fs.existsSync(path.join(root, 'skills', 'migrate-ids', 'SKILL.md')), false);
  // 카탈로그에서 뺀 스킬은 migrate-ids와 같이 부재를 고정한다. 개수 단언만 두면
  // 다른 이름을 넣어도 6이면 통과한다.
  assert.equal(fs.existsSync(path.join(root, 'skills', 'agentic-code-benchmark', 'SKILL.md')), false);
  for (const rel of [
    'skills/bouncer-plan/references/distill-preflight.md',
    'skills/bouncer-plan/references/graphify-suggestions.md',
  ]) assert.equal(fs.existsSync(path.join(root, rel)), false, rel);
});

test('canonical skill catalog → contains the four explicit workflow entries', () => {
  const skillNames = listCanonicalSkillNames();
  assert.strictEqual(
    skillNames.length,
    EXPECTED_SKILL_COUNT,
    `canonical skill count is ${skillNames.length}, expected ${EXPECTED_SKILL_COUNT}; `
      + 'raising this cap requires a human review of the contract',
  );

  for (const name of skillNames) {
    const { data } = parseFrontmatter(readWorkflow(name));
    assert.match(String(data.description), /^Use only when the user explicitly asks \//, name);
  }
});

// plan 문서의 복잡도 선언: 축약 light 안내가 없고, 닫힌 기록 두 파일만
// scale: light를 읽기 값으로 설명한다.
const PLAN_DOCS = [
  'rules/planning.md',
  'skills/bouncer-plan/SKILL.md',
  'skills/bouncer-plan/references/context-review.md',
  'skills/bouncer-plan/references/roundtrip.md',
  'skills/bouncer-plan/references/evidence-dispatch.md',
  'references/spec-authoring/index.md',
  'references/context-review/index.md',
  'references/minimality/index.md',
  'references/discovery/index.md',
  'agents/bouncer-context-reviewer.md',
  'agents/bouncer-plan-coordinator.md',
  '.codex/agents/bouncer-context-reviewer.toml',
  '.codex/agents/bouncer-plan-coordinator.toml',
  'rules/document-schema.md',
  'docs/workflow.md',
];
const CLOSED_RECORD_DOCS = ['rules/planning.md', 'rules/document-schema.md'];
const QUIZ_DOCS = [
  'references/explain-diff/index.md',
  'skills/bouncer-finalize/references/explain-quiz.md',
];
const COMPLEXITY_LOW_REVIEW_DOCS = [
  'references/context-review/index.md',
  'skills/bouncer-plan/references/context-review.md',
  'agents/bouncer-context-reviewer.md',
  '.codex/agents/bouncer-context-reviewer.toml',
];
const EVALUATOR_POLICY_DOCS = [
  'benchmarks/configs/fastify-001-evaluator-policy.json',
  'benchmarks/configs/deepswe-quill-001-evaluator-policy.json',
  'benchmarks/configs/deepswe-expr-001-evaluator-policy.json',
  'benchmarks/configs/deepswe-statemachine-001-evaluator-policy.json',
  'benchmarks/configs/deepswe-oxvg-001-evaluator-policy.json',
];

/**
 * 저장소 루트 기준 상대 경로의 문서 원문을 읽는다.
 *
 * @param {string} rel - cwd 기준 상대 경로
 * @returns {string} 파일 전체 텍스트
 */
function readPlanDoc(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('plan docs → omit retired light-scope vocabulary', () => {
  const banned = /plan\.light_scope|--scale light|Lightweight cycle|light plan/;
  for (const rel of PLAN_DOCS) {
    assert.doesNotMatch(readPlanDoc(rel), banned, rel);
  }
});

test('plan docs except closed-record readers → omit scale: light and the word light', () => {
  for (const rel of PLAN_DOCS.filter((r) => !CLOSED_RECORD_DOCS.includes(r))) {
    assert.doesNotMatch(readPlanDoc(rel), /scale: light|\blight/i, rel);
  }
});

test('quiz docs → omit the light one-question exception', () => {
  for (const rel of QUIZ_DOCS) {
    assert.doesNotMatch(readPlanDoc(rel), /exactly one question|경량 예외/, rel);
  }
});

test('plan docs → declare complexity instead of light scope', () => {
  assert.match(readPlanDoc('rules/planning.md'), /^## Complexity declaration$/m);
  const catalog = JSON.parse(readPlanDoc('rules/acq-gates.json'));
  assert.ok(catalog.workflows['bouncer-plan'].includes('plan.complexity'));
  assert.equal(catalog.workflows['bouncer-plan'].includes('plan.light_scope'), false);
  for (const rel of EVALUATOR_POLICY_DOCS) {
    const policy = JSON.parse(readPlanDoc(rel));
    assert.ok(
      policy.bouncer_decisions.some((d) => d.gate === 'plan.complexity' && d.answer === 'standard'),
      rel,
    );
  }
  const skill = readPlanDoc('skills/bouncer-plan/SKILL.md');
  assert.match(skill, /\*\*AskUserQuestion — plan\.complexity\*\*/);
  assert.match(skill, /--complexity[\s\S]*CLI is outdated/);
  for (const rel of COMPLEXITY_LOW_REVIEW_DOCS) {
    assert.match(readPlanDoc(rel), /complexity low: verifiability/, rel);
  }
  const schema = readPlanDoc('rules/document-schema.md');
  assert.match(schema, /complexity/);
  assert.match(schema, /\blow\b/);
  assert.match(schema, /\bstandard\b/);
  assert.match(schema, /S38/);
  assert.match(readPlanDoc('references/minimality/index.md'), /bouncer\.complexity/);
  // 추천 기준은 routing의 모듈 문턱(complexity.strong_min_modules)과 위험 경로뿐이고, task 수·depends_on은 근거가 아니다.
  assert.match(skill, /complexity\.strong_min_modules/);
  assert.match(skill, /The task count and the `depends_on` count are not grounds/);
  assert.equal((skill.match(/\*\*Recommend-why\*\*/g) || []).length, 2);
});

test('configuration doc → lists the seven complexity keys', () => {
  const doc = readPlanDoc('docs/configuration.md');
  for (const key of [
    'single_max_source_files', 'single_max_source_lines', 'strong_min_source_files', 'strong_min_modules',
    'strong_min_total_files', 'risk_paths', 'generated_paths',
  ]) {
    assert.ok(doc.includes(`complexity.${key}`), key);
  }
});

