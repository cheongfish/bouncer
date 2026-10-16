'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { GENERIC_SKILLS } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const WORKFLOW = [
  'bouncer-init', 'bouncer-plan', 'bouncer-finalize', 'bouncer-run', 'bouncer-retro',
];
// 공개 진입에서 제거한 스킬. 파일이 다시 생기면 아래 부재 단언이 실패한다.
const RETIRED = ['bouncer-execute', 'bouncer-commit'];
// Subskills live at references/<name>/index.md (not the host skills/ catalog).
const SUB_PATHS = [
  'discovery', 'spec-authoring', 'implementation', 'verification',
  'review', 'minimality', 'debugging', 'graphify-runner', 'explain-diff',
  'stop-slop', 'context-review',
];
const UNPUBLISHED = [
  'discovery', 'spec-authoring', 'stop-slop', 'graphify-runner', 'minimality',
  'context-review', 'implementation', 'verification', 'debugging', 'review',
  'explain-diff',
];
const UNPUBLISHED_SET = new Set(UNPUBLISHED);

// 호스트 카탈로그는 워크플로 다섯뿐이다(102-001에서 execute·commit 제거). 폐기한 agentic-code-benchmark를 다시 넣지 않는다.
const EXPECTED_SKILL_COUNT = 5;
const MIN_DESCRIPTION_CHARS = 100;
const MAX_DESCRIPTION_CHARS = 180;
const MAX_TOTAL_DESCRIPTION_CHARS = 3000;

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

/**
 * YAML `description:` 줄에서 접두어만 제거한 원문 scalar를 꺼낸다.
 * 예산은 파서가 벗긴 값이 아니라 인용부호를 포함한 한 줄 길이라서
 * parseFrontmatter 결과를 쓰면 안 된다.
 *
 * @param {string} skillName - 스킬 디렉터리 이름
 * @param {string} md - SKILL.md 원문
 * @returns {string} `description:` 접두어를 뺀 나머지
 */
function rawDescriptionScalar(skillName, md) {
  const hits = md.split('\n').filter((line) => /^description:\s*/.test(line));
  assert.strictEqual(
    hits.length,
    1,
    `${skillName}: expected exactly one description: line, found ${hits.length}`,
  );
  return hits[0].replace(/^description:\s*/, '');
}

/**
 * 원문 scalar가 비어 있지 않고 한 문장인지 본다.
 * 두 번째 문장(마침표 뒤 본문)이 생기면 암묵 매칭 근거가 늘어나 예산을 우회한다.
 *
 * @param {string} skillName - 스킬 디렉터리 이름
 * @param {string} scalar - YAML 원문 scalar
 * @returns {void}
 */
function assertOneSentenceDescription(skillName, scalar) {
  assert.ok(scalar.length > 0, `${skillName}: description scalar is empty`);
  const inner = scalar.replace(/^"(.*)"$/, '$1');
  assert.match(
    inner,
    /\.$/,
    `${skillName}: description must be one sentence ending with a period`,
  );
  assert.doesNotMatch(
    inner,
    /\.\s+\S/,
    `${skillName}: description must be a single sentence`,
  );
}

function readWorkflow(name) {
  return fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
}

// 세션이 루트를 먼저 얻고 plugin-root 계약을 루트 기준으로 연다. 여섯 문단이 바이트까지
// 같아야 한다는 일치 계약이며, 규칙 문서의 설명 문장은 고정하지 않는다.
test('workflow Plugin root paragraphs → are byte-identical across the six workflow skills', () => {
  const PLUGIN_ROOT_LINE = '**Plugin root.** Run `BOUNCER_ROOT="$(bouncer-root --auto)"` once at session start and open every plugin document cited as `${BOUNCER_ROOT}/…` from that root; `${BOUNCER_ROOT}/rules/plugin-root.md` holds the shared root-selection and rule-loading contract.';
  for (const name of WORKFLOW) assert.ok(readWorkflow(name).includes(`\n${PLUGIN_ROOT_LINE}\n`), name);
});

// BP001 착수 시점 단어 수. 합계가 이 값보다 작다는 기존 판정만 유지하고,
// 스킬별 숫자는 이후 성장이 어디서 났는지 보는 영수증이다.
// TASKS-002: Plugin root 줄이 루트 명령을 직접 실어 스킬당 +17 단어 → 합계 상한도
// 같은 폭으로 올려 의도된 성장이 회귀 판정에 걸리지 않게 한다.
const ENTRY_WORD_BASELINE = {
  'bouncer-init': 428,
  'bouncer-plan': 2348,
  // 090-002 repair: step 4 early-handback 복구 표·규칙이 더한 +199 단어만 반영한다.
  'bouncer-run': 1357,
  // 095-004: 자동 retro 문단 +96 단어
  'bouncer-finalize': 1098,
  // 095-004: retro 스킬 실제 단어 수 + 1. 기존 합계 판정이 새 스킬 때문에 흔들리지 않게 한다.
  'bouncer-retro': 473,
};

// 102-001에서 제거한 스킬의 BP001 착수 시점 단어 수. 합계 기준(before)은 착수 시점 값이므로
// 파일이 사라져도 이 값을 유지하고, 현재 단어 수는 0으로 센다. 남은 스킬의 영수증은 올리지 않는다.
const RETIRED_WORD_BASELINE = { 'bouncer-execute': 2018, 'bouncer-commit': 943 };

test('entry-skill word count → stays below the BP001 baseline', () => {
  const counts = Object.fromEntries(Object.keys(ENTRY_WORD_BASELINE).map((name) => [
    name,
    readWorkflow(name).trim().split(/\s+/).length,
  ]));
  const before = [...Object.values(ENTRY_WORD_BASELINE), ...Object.values(RETIRED_WORD_BASELINE)]
    .reduce((sum, count) => sum + count, 0);
  const after = Object.values(counts).reduce((sum, count) => sum + count, 0);
  assert.ok(after < before, `expected < ${before} words, received ${after}`);
});

/**
 * ACQ 색인 앞 본문에서 1부터 이어지는 최상위 번호 단계 개수.
 * 들여 쓴 AskUserQuestion 항목은 세지 않는다.
 *
 * @param {string} md - SKILL.md 원문
 * @returns {number} 연속된 1..N 단계 수
 */
function countNumberedSteps(md) {
  const acqAt = md.search(/^## ACQ \(AskUserQuestion\) gates$/m);
  const procedure = acqAt === -1 ? md : md.slice(0, acqAt);
  const numbers = [...procedure.matchAll(/^(\d+)\. /gm)].map((hit) => Number(hit[1]));
  let count = 0;
  for (let i = 0; i < numbers.length; i += 1) {
    if (numbers[i] !== i + 1) break;
    count += 1;
  }
  return count;
}

const ENTRY_STEP_COUNTS = {
  'bouncer-init': 4,
  'bouncer-plan': 8,
  'bouncer-run': 5,
  'bouncer-finalize': 5,
  'bouncer-retro': 5,
};

test('entry skills → keep the locked numbered-step counts', () => {
  for (const [name, expected] of Object.entries(ENTRY_STEP_COUNTS)) {
    const actual = countNumberedSteps(readWorkflow(name));
    assert.strictEqual(actual, expected, `${name}: expected ${expected} numbered steps, received ${actual}`);
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
  'bouncer-retro': { root: [], local: [] },
  'bouncer-finalize': {
    root: [],
    local: ['distill-promotion.md', 'explain-quiz.md', 'draft-pr.md', 'cleanup-handoff.md', 'remainder.md'],
  },
};

test('entry skills → do not load conditional helpers before numbered steps', () => {
  for (const name of WORKFLOW) {
    const preamble = numberedProcedurePreamble(readWorkflow(name));
    const { root, local, sibling = [] } = CONDITIONAL_HELPERS[name];
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
    for (const file of sibling) {
      assert.doesNotMatch(
        preamble,
        new RegExp(`\\.\\./bouncer-run/references/${file.replace(/\./g, '\\.')}`),
        `${name}: sibling ${file} is owned by a later conditional step`,
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
  return [...md.matchAll(/(?<!\$\{BOUNCER_ROOT\}\/|\.\/|\.\.\/bouncer-run\/)references\/[A-Za-z0-9._/-]+/g)]
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
  ],
  'bouncer-run': ['light-run.md', 'direct-run.md'],
  'bouncer-retro': [],
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

test('workflow skill bodies → use English headings', () => {
  for (const name of WORKFLOW) {
    const md = readWorkflow(name);
    const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
    assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
  }
});

/**
 * 보조는 references/<name>/index.md에만 둔다. SUB_PATHS를 skills/로 되돌리지 않는다.
 *
 * @param {string} name - 서브스킬 디렉터리 이름
 * @returns {string} 본문 절대 경로
 */
function subSkillPath(name) {
  if (UNPUBLISHED_SET.has(name)) {
    return path.join(root, 'references', name, 'index.md');
  }
  return path.join(root, 'skills', name, 'SKILL.md');
}

test('sub-skill bodies → use English headings', () => {
  for (const name of SUB_PATHS) {
    const md = fs.readFileSync(subSkillPath(name), 'utf8');
    const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
    assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
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
});

test('canonical skill descriptions → stay within the locked YAML-scalar budget', () => {
  const skillNames = listCanonicalSkillNames();
  assert.strictEqual(
    skillNames.length,
    EXPECTED_SKILL_COUNT,
    `canonical skill count is ${skillNames.length}, expected ${EXPECTED_SKILL_COUNT}; `
      + 'raising this cap requires a human review of the contract',
  );

  let total = 0;
  for (const name of skillNames) {
    const md = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const scalar = rawDescriptionScalar(name, md);
    assertOneSentenceDescription(name, scalar);
    const length = scalar.length;
    total += length;
    assert.ok(
      length >= MIN_DESCRIPTION_CHARS && length <= MAX_DESCRIPTION_CHARS,
      `${name}: description YAML scalar length is ${length}, expected ${MIN_DESCRIPTION_CHARS}..${MAX_DESCRIPTION_CHARS}; `
        + 'raising this cap requires a human review of the contract',
    );
  }

  assert.ok(
    total <= MAX_TOTAL_DESCRIPTION_CHARS,
    `total description YAML scalar length is ${total}, cap is ${MAX_TOTAL_DESCRIPTION_CHARS}; `
      + 'raising this cap requires a human review of the contract',
  );
});

// 심볼 선택 지침은 controller가 읽는 문서가 곧 계약이다. 문서 제목·테스트 이름을
// 함수처럼 넣어 빈 intent 투영을 만드는 일을 막으므로 이 문구 자체를 계약으로 확인한다.
test('intent bundle paragraphs → name --no-symbols and the excluded symbol sources', () => {
  const docs = {
    'references/coordinator-cards/dispatch.md': fs.readFileSync(path.join(root, 'references/coordinator-cards/dispatch.md'), 'utf8'),
  };
  for (const [name, body] of Object.entries(docs)) {
    const flat = body.replace(/\s+/g, ' ');
    for (const needle of ['--no-symbols', 'document headings', 'item numbers', 'test names']) {
      assert.ok(flat.includes(needle), `${name} missing ${needle}`);
    }
  }
});
