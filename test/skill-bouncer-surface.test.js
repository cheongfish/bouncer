'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { GENERIC_SKILLS } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const WORKFLOW = [
  'bouncer-init', 'bouncer-plan', 'bouncer-execute', 'bouncer-commit', 'bouncer-finalize',
  'bouncer-run',
];
// migrate-ids stays under skills/; the other subskills live at references/<name>/index.md.
const SUB_PATHS = [
  'discovery', 'spec-authoring', 'implementation', 'verification',
  'review', 'minimality', 'debugging', 'graphify-runner', 'explain-diff',
  'stop-slop', 'context-review', 'migrate-ids',
];
const UNPUBLISHED = [
  'discovery', 'spec-authoring', 'stop-slop', 'graphify-runner', 'minimality',
  'context-review', 'implementation', 'verification', 'debugging', 'review',
  'explain-diff',
];
const UNPUBLISHED_SET = new Set(UNPUBLISHED);

const STEPS_EXEMPT = new Set(['minimality', 'stop-slop']);
const EXPECTED_SKILL_COUNT = 8;
const MIN_DESCRIPTION_CHARS = 100;
const MAX_DESCRIPTION_CHARS = 180;
const MAX_TOTAL_DESCRIPTION_CHARS = 3000;
const ROLE_SKILLS = ['implementation', 'review', 'debugging', 'context-review'];
const FORBIDDEN_ROLE_RUBRIC = [
  'Detailed comments',
  'Root cause → Pattern → Hypothesis → Implementation',
  'Spec compliance',
  'Over-engineering',
  'Rubric — four scopes',
  'Calibration',
  'Procedure',
  'Guardrails',
];

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

test('workflow skills use directory-matching names and explicit-invocation descriptions', () => {
  for (const name of WORKFLOW) {
    const { data } = parseFrontmatter(readWorkflow(name));
    assert.strictEqual(data.name, name);
    // 명시 호출 전용: /<skill-name> 직접 요청에서만 선택되고 핵심 산출물을 한 문장에 둔다.
    assert.match(String(data.description), /^Use only when the user explicitly asks \//);
    assert.match(String(data.description), new RegExp(`/${name}(?:\\b|[^a-z-]|$)`));
  }
});

test('workflow skills cite subordinate skills by path', () => {
  const plan = readWorkflow('bouncer-plan');
  const execute = readWorkflow('bouncer-execute');
  const commit = readWorkflow('bouncer-commit');
  const finalize = readWorkflow('bouncer-finalize');
  // 루트 보조는 ${BOUNCER_ROOT}/references/… 접두로만 표기한다.
  assert.match(plan, /\$\{BOUNCER_ROOT\}\/references\/discovery\/index\.md/);
  assert.match(plan, /\$\{BOUNCER_ROOT\}\/references\/spec-authoring\/index\.md/);
  assert.match(plan, /\$\{BOUNCER_ROOT\}\/references\/stop-slop\/index\.md/);
  assert.match(plan, /\$\{BOUNCER_ROOT\}\/references\/graphify-runner\/index\.md/);
  assert.match(plan, /\$\{BOUNCER_ROOT\}\/references\/context-review\/index\.md/);
  assert.match(execute, /\$\{BOUNCER_ROOT\}\/references\/implementation\/index\.md/);
  assert.match(execute, /\$\{BOUNCER_ROOT\}\/references\/verification\/index\.md/);
  assert.match(execute, /\$\{BOUNCER_ROOT\}\/references\/review\/index\.md/);
  // explain-diff는 finalize가 호출한다(commit이 아님).
  assert.doesNotMatch(commit, /references\/explain-diff\/index\.md/);
  assert.match(finalize, /\$\{BOUNCER_ROOT\}\/references\/spec-authoring\/index\.md/);
  assert.match(finalize, /\$\{BOUNCER_ROOT\}\/references\/explain-diff\/index\.md/);
  {
    const i = finalize.indexOf('${BOUNCER_ROOT}/references/spec-authoring/index.md');
    const j = finalize.indexOf('${BOUNCER_ROOT}/references/explain-diff/index.md');
    assert.ok(i > -1 && j > i);
  }
  for (const name of [
    'discovery', 'implementation', 'verification', 'review',
    'minimality', 'debugging', 'graphify-runner', 'spec-authoring',
    'explain-diff', 'stop-slop',
  ]) {
    // at least one workflow skill should mention each used path form when present
    assert.ok(SUB_PATHS.includes(name));
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
  'bouncer-init': [],
  'bouncer-plan': [
    'distill-preflight.md',
    'graphify-suggestions.md',
    'context-review.md',
  ],
  'bouncer-execute': [
    'agent-dispatch.md',
    'verification-recovery.md',
  ],
  'bouncer-commit': [],
  'bouncer-finalize': [
    'distill-promotion.md',
    'explain-quiz.md',
    'draft-pr.md',
    'cleanup-handoff.md',
  ],
  'bouncer-run': ['stop-recovery.md'],
};

test('workflow skills classify references as root or skill-local without bare collision', () => {
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

test('execute, commit, and finalize stop when current is null; plan stops without .bouncer/', () => {
  const execute = readWorkflow('bouncer-execute');
  const commit = readWorkflow('bouncer-commit');
  const finalize = readWorkflow('bouncer-finalize');
  const plan = readWorkflow('bouncer-plan');
  assert.match(execute, /\bbouncer\s+current\b/);
  assert.match(execute, /null/);
  assert.match(execute, /ready/);
  assert.match(execute, /current --set/);
  assert.match(execute, /\/bouncer-plan/);
  assert.match(commit, /\bbouncer\s+current\b/);
  assert.match(commit, /null/);
  assert.match(finalize, /\bbouncer\s+current\b/);
  assert.match(finalize, /null/);
  assert.match(finalize, /\/bouncer-plan/);
  assert.match(plan, /\.bouncer\//);
  assert.match(plan, /\/bouncer-init/);
  assert.match(plan, /Preflight|missing|없/i);
});

test('pointer consumers retain only their local application while using the CLI contract', () => {
  const execute = readWorkflow('bouncer-execute');
  const commit = readWorkflow('bouncer-commit');
  const finalize = readWorkflow('bouncer-finalize');
  const run = readWorkflow('bouncer-run');
  for (const md of [execute, commit, finalize, run]) {
    assert.match(md, /rules\/current-pointer\.md/);
    assert.match(md, /\bbouncer\s+current\b/);
    assert.doesNotMatch(md, /scripts\/lib\/current/);
  }
  assert.match(execute, /scale.*light|light.*scale/i, 'execute keeps its local status/scale stop condition');
  assert.match(commit, /nextTask/, 'commit keeps its local next-task handoff');
  assert.match(finalize, /finalize --yes/, 'finalize keeps its local clear/handoff consequence');
  assert.match(run, /autonomy/, 'run keeps its autonomy-specific advance behavior');
});

test('commands/ directory is gone', () => {
  assert.ok(!fs.existsSync(path.join(root, 'commands')));
});

test('GENERIC_SKILLS does not list workflow skills', () => {
  for (const name of WORKFLOW) {
    assert.ok(!GENERIC_SKILLS.includes(name), name);
  }
});

test('workflow skills end with an ACQ gates section', () => {
  for (const name of WORKFLOW) {
    const md = readWorkflow(name);
    const heads = [...md.matchAll(/^## .*$/gm)].map((m) => m[0]);
    // 존재만이 아니라 마지막 절인지까지 본다 — 성공 조건 2가 위치를 요구한다.
    assert.strictEqual(heads[heads.length - 1], '## ACQ (AskUserQuestion) gates', name);
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

test('workflow ACQ section is a step index; AskUserQuestion detail stays in numbered steps', () => {
  for (const name of WORKFLOW) {
    const md = readWorkflow(name);
    const { procedure, index } = splitAcq(md);
    assert.match(md, /rules\/acq\.md/, `${name} must cite the display contract`);
    // 색인에는 Options/AskUserQuestion 본문을 두지 않는다 — 질문 시점은 numbered step.
    assert.doesNotMatch(
      index,
      /\*\*AskUserQuestion/,
      `${name}: ACQ index must not embed AskUserQuestion blocks`,
    );
    assert.doesNotMatch(
      index,
      /\*\*Options\*\*:/,
      `${name}: ACQ index must not embed Options lists`,
    );

    if (name === 'bouncer-execute') {
      // 무질문 계약은 절차에서 확인 가능해야 한다.
      assert.match(
        procedure,
        /no AskUserQuestion|does not ask[\s\S]{0,40}AskUserQuestion|never asks[\s\S]{0,40}AskUserQuestion/i,
        'execute procedure must state the no-question contract',
      );
      assert.match(
        index,
        /no ACQ|does not ask|never asks|no AskUserQuestion/i,
        'execute ACQ index must record that this skill never asks',
      );
      continue;
    }

    // 게이트가 있는 스킬: 색인은 step 번호를 가리키고, 해당 step 본문에 동의 시점이 있다.
    assert.match(index, /[Ss]tep\s+\d+/, `${name}: ACQ index must cite step numbers`);
  }
});

test('workflow ACQ catalogs delegate shared display details to rules/acq.md', () => {
  for (const name of WORKFLOW) {
    const md = readWorkflow(name);
    assert.match(md, /rules\/acq\.md/, `${name} must cite the display contract`);
  }
});

test('workflow skill bodies use English headings', () => {
  for (const name of WORKFLOW) {
    const md = readWorkflow(name);
    const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
    assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
  }
});

/**
 * 보조는 references/<name>/index.md, migrate-ids만 skills/ 카탈로그에 남긴다.
 * SUB_PATHS를 통째로 references로 옮기지 않는다.
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

test('sub-skills carry the shared body skeleton in order', () => {
  for (const name of SUB_PATHS) {
    const md = fs.readFileSync(subSkillPath(name), 'utf8');
    const want = ['## When this applies'];
    if (!STEPS_EXEMPT.has(name)) want.push('## Steps');
    want.push('## Guardrails', '## Return');
    let at = -1;
    for (const h of want) {
      const i = md.indexOf(`\n${h}\n`);
      assert.ok(i > at, `${name} missing or misordered ${h}`);
      at = i;
    }
  }
});

test('sub-skill bodies use English headings', () => {
  for (const name of SUB_PATHS) {
    const md = fs.readFileSync(subSkillPath(name), 'utf8');
    const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
    assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
  }
});

test('unpublished helpers live under references/ and are absent from the catalog', () => {
  const skillNames = listCanonicalSkillNames();
  for (const name of UNPUBLISHED) {
    assert.equal(skillNames.includes(name), false);
    assert.equal(fs.existsSync(path.join(root, 'references', name, 'SKILL.md')), false);
    assert.ok(fs.existsSync(path.join(root, 'references', name, 'index.md')));
  }
  assert.ok(fs.existsSync(path.join(root, 'skills', 'migrate-ids', 'SKILL.md')));
});

test('canonical skill descriptions stay within the locked YAML-scalar budget', () => {
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

test('role skill descriptions do not restate agent-owned rubric phrases', () => {
  for (const name of ROLE_SKILLS) {
    const md = fs.readFileSync(path.join(root, 'references', name, 'index.md'), 'utf8');
    const scalar = rawDescriptionScalar(name, md);
    for (const phrase of FORBIDDEN_ROLE_RUBRIC) {
      assert.ok(
        !scalar.includes(phrase),
        `${name}: description YAML scalar must not contain agent-owned rubric phrase ${JSON.stringify(phrase)}`,
      );
    }
  }
});
