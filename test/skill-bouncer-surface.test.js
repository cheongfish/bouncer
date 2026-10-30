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
  'bouncer-run': ['light-run.md', 'direct-run.md'],
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

test('plan review procedure → confirms record success before revising documents', () => {
  const skill = fs.readFileSync(path.join(root, 'skills/bouncer-plan/SKILL.md'), 'utf8');
  const review = fs.readFileSync(
    path.join(root, 'skills/bouncer-plan/references/context-review.md'), 'utf8',
  );
  const executeReview = fs.readFileSync(
    path.join(root, 'skills/bouncer-run/references/agent-dispatch.md'), 'utf8',
  );
  assert.match(skill, /bouncer subagent-model --agent\s*`?bouncer-context-reviewer/);
  assert.match(review, /`agent_dispatch` snapshot/);
  assert.match(review, /Immediately\s+before each call[\s\S]*current config[\s\S]*resolve again/i);
  assert.match(executeReview, /execute `review-dispatch` payload's\s+`agent_dispatch` snapshot/);
  assert.match(executeReview, /Immediately before each call, compare it with current config/);
  const merge = review.indexOf('3. **Merge**');
  const record = review.indexOf('**Record**', merge);
  const revise = review.indexOf('**Revise once**', merge);
  assert.ok(merge >= 0, 'Merge step missing');
  assert.ok(record > merge, 'independent Record step must follow Merge');
  assert.ok(revise > record, 'Revise must follow successful Record');
  assert.ok(/verify success before editing/i.test(review));
});

test('plan skill → delegates to the plan coordinator and keeps approvals with the root', () => {
  const skill = fs.readFileSync(path.join(root, 'skills/bouncer-plan/SKILL.md'), 'utf8')
    .replace(/\s+/g, ' ');
  const sentences = [
    'The root runs every ACQ, `plan-ledger open`, `plan-ledger answer`, `plan-ledger close`, `context-review close`, `plan approve`, `current --set`, and `validate --gate plan`; the plan coordinator and planner never do.',
    'Outside the fallback the root does not run discovery, author plan documents, or dispatch reviewers.',
    'The planner writes task `affected_paths` only from the confirmed candidate set; a path outside it returns `needs_user` and the root asks `plan.affected_paths` again.',
    'If a question the root did not answer shows an answer in `plan-ledger status`, the root stops and reports its `qid`.',
    'Any other `blocked` outcome stops with its code, message, and next; a missing or unknown outcome gets one re-dispatch with the same input, then stops as no progress.',
    'The root runs `plan-ledger close` only after `validate --gate plan` passes; a rejected approval or a failed gate leaves the ledger open.',
  ];
  for (const sentence of sentences) {
    assert.ok(skill.includes(sentence), sentence);
  }
  assert.match(skill, /bouncer plan-ledger open --request/);
  assert.match(skill, /bouncer subagent-model --agent\s*`?bouncer-plan-coordinator/);
  assert.match(skill, /`outcome: checkpoint`/);
  assert.match(skill, /plan-ledger record --planner-mode continued/);
  assert.match(skill, /--kind plan-coordinator-session/);
});

// 후보 생성은 작성 전 단계다: 옛 "작성 후 후보 생성" 순서와 확인된 집합만 쓴다는 규칙이 모순되지 않아야 한다.
test('plan skill → builds candidates before authoring and re-confirms paths outside the set', () => {
  const skill = fs.readFileSync(path.join(root, 'skills/bouncer-plan/SKILL.md'), 'utf8')
    .replace(/\s+/g, ' ');
  assert.ok(!skill.includes('After authoring, build candidates'), 'old candidate-after-authoring order must be gone');
  assert.ok(skill.includes('Before authoring task documents, build candidates'), 'candidates must be built before authoring');
  assert.ok(skill.includes('a path outside it returns `needs_user` and the root asks `plan.affected_paths` again'));
});

// 사용자 동의 전 표시·경로 출처·fallback 조건별 책임은 의미 단위로만 확인한다(문장 순서·공백은 고정하지 않는다).
test('plan skill → shows dispositions before consent, reads paths from task frontmatter, splits fallback', () => {
  const skill = fs.readFileSync(path.join(root, 'skills/bouncer-plan/SKILL.md'), 'utf8')
    .replace(/\s+/g, ' ');
  const section = (from, to) => {
    const start = skill.indexOf(from);
    assert.ok(start >= 0, from);
    const end = skill.indexOf(to, start + from.length);
    assert.ok(end > start, to);
    return skill.slice(start, end);
  };
  const review = section('5. **Review.**', '6. **Approval (explicit).**');
  assert.match(review, /before it asks for consent,? the root reads the dispositions file[\s\S]*ID[\s\S]*disposition[\s\S]*note/i);
  assert.match(review, /accepted-risk[\s\S]*(?:concrete risk)[\s\S]*why[\s\S]*basis[\s\S]*explicit consent[\s\S]*(?:that|each) ID/i);
  const approval = section('6. **Approval (explicit).**', '7. **Activate.**');
  assert.match(approval, /`affected_paths`[\s\S]*(?:reads|read)[\s\S]*directly from (?:that|each) task'?s? frontmatter[\s\S]*not from the coordinator summary/i);
  const step3 = section('3. ', '4. **Scope confirm.**');
  assert.ok(!/show them before step 4/i.test(step3), 'step 3 must not tell the root to show candidates itself');
  const fallback = section('## Fallback', '## ACQ');
  assert.match(fallback, /`blocked: nesting-unavailable`[\s\S]*root[\s\S]*coordinator[\s\S]*`plan-ledger status` phase[\s\S]*reviewer dispatch/i);
  assert.match(fallback, /no subagent[\s\S]*generic[\s\S]*inline[\s\S]*print/i);
  assert.match(fallback, /`bouncer context-review route` `next_action`[\s\S]*never approves without `plan.approval`/);
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

// 심볼 선택 지침은 controller가 읽는 문서가 곧 계약이다. 문서 제목·테스트 이름을
// 함수처럼 넣어 빈 intent 투영을 만드는 일을 막으므로 이 문구 자체를 계약으로 확인한다.
// 정본은 dispatch 카드에서 agent-dispatch로 옮겨졌고, 카드는 그 절을 링크한다.
test('intent bundle paragraphs → name --no-symbols and the excluded symbol sources', () => {
  const docs = {
    'skills/bouncer-run/references/agent-dispatch.md': fs.readFileSync(path.join(root, 'skills/bouncer-run/references/agent-dispatch.md'), 'utf8'),
  };
  for (const [name, body] of Object.entries(docs)) {
    const flat = body.replace(/\s+/g, ' ');
    for (const needle of ['--no-symbols', 'document headings', 'item numbers', 'test names']) {
      assert.ok(flat.includes(needle), `${name} missing ${needle}`);
    }
  }
});

// 결합 경로 확인 흐름은 plan SKILL step 4, scope-confirm.md, plan coordinator step 5가 같은 순서로 말해야 한다:
// 초안 뒤 inspect → ask·needs_user → root가 plan.affected_paths 재질문 → 확정 값만 기록.
// 문장 순서와 줄바꿈은 고정하지 않도록 공백을 한 칸으로 줄여 비교한다.
test('plan docs → describe the coupled-path confirm flow in SKILL step 4, scope-confirm, and plan coordinator', () => {
  const squash = (text) => text.replace(/\s+/g, ' ');
  const skill = squash(fs.readFileSync(path.join(root, 'skills/bouncer-plan/SKILL.md'), 'utf8'));
  const scopeConfirm = squash(fs.readFileSync(
    path.join(root, 'skills/bouncer-plan/references/scope-confirm.md'),
    'utf8',
  ));
  const planCoordinator = squash(fs.readFileSync(path.join(root, 'agents/bouncer-plan-coordinator.md'), 'utf8'));
  const start = skill.indexOf('4. **Scope confirm.**');
  const end = skill.indexOf('5. **Review.**', start);
  assert.ok(start >= 0 && end > start, 'SKILL step 4 must exist');
  const step4 = skill.slice(start, end);

  assert.match(
    step4,
    /plan inspect --blueprint[\s\S]*coupledPaths[\s\S]*covered: false[\s\S]*needs_user[\s\S]*plan\.affected_paths/,
  );
  assert.ok(step4.includes('never from Graphify query results, candidate lists, or inspect output'));
  assert.ok(step4.includes('<path> — <kind> (<source>[, line <n>: <text>])'));
  assert.match(step4, /<task>\|<kind>\|<source>\|<path>/);
  assert.match(scopeConfirm, /coupledPaths[\s\S]*plan coordinator[\s\S]*root[\s\S]*plan\.affected_paths/);
  assert.match(scopeConfirm, /evidence\.text[^.]*data/);
  assert.match(planCoordinator, /plan inspect --blueprint[\s\S]*`ask`[\s\S]*needs_user/);
});

/**
 * skills/bouncer-run 아래 모든 .md를 재귀로 읽어 [상대경로, 원문] 목록을 만든다.
 * light·direct 통합 뒤에도 문서가 inline 구현을 지시하지 않는지 검사하려고
 * 스킬 루트와 references를 한 번에 훑는다.
 *
 * @returns {Array<[string, string]>}
 */
function listBouncerRunMarkdown() {
  const runRoot = path.join(root, 'skills', 'bouncer-run');
  /** @type {Array<[string, string]>} */
  const out = [];
  /**
   * @param {string} dir
   * @returns {void}
   */
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      out.push([path.relative(root, abs).split(path.sep).join('/'), fs.readFileSync(abs, 'utf8')]);
    }
  }
  walk(runRoot);
  return out;
}

// light 직렬 직접 실행 통합: run 세션은 구현하지 않고, light-run.md는 승격·호환만 담는다.
// 줄바꿈된 금지 문구를 잡으려면 공백을 한 칸으로 접은 뒤 정규식을 건다.
test('bouncer-run docs → ban inline implement phrases, keep promotion table and compat stop rules', () => {
  const runDocs = listBouncerRunMarkdown();
  const banned = [
    /payload\.inline: true/,
    /implement via `payload\.inline`/,
    /performs the `implementation` skill itself/,
    /run the implementer \*\*inline\*\*/,
  ];
  for (const [rel, text] of runDocs) {
    const flat = text.replace(/\s+/g, ' ');
    for (const re of banned) {
      assert.doesNotMatch(flat, re, rel);
    }
  }

  const lightRun = fs.readFileSync(
    path.join(root, 'skills/bouncer-run/references/light-run.md'),
    'utf8',
  );
  const flatLightRun = lightRun.replace(/\s+/g, ' ');
  const row = lightRun.split('\n').find(
    (line) => line.startsWith('|') && line.includes('light-scope-revision-requires-promotion'),
  );
  assert.ok(row && row.includes('out-of-scope'), 'promotion row must map scope revision to out-of-scope');
  for (const reason of [
    'security-risk',
    'out-of-scope',
    'task-split',
    'interface-semantics',
    'reviewer-wider-scope',
  ]) {
    assert.ok(
      lightRun.split('\n').some((line) => line.startsWith('|') && line.includes(reason)),
      `promotion table must include reason ${reason}`,
    );
  }
  assert.ok(flatLightRun.includes(
    'If the `implement` payload carries an `inline` key, do not implement; stop and report a CLI version mismatch.',
  ));
  for (const code of [
    'light-ledger-legacy',
    'light-inline-removed',
    'light-implementer-record-missing',
  ]) {
    assert.ok(lightRun.includes(code), `light-run.md must name ${code}`);
  }
  assert.doesNotMatch(
    flatLightRun,
    /record[^.]*worker-model[^.]*(retry|rerun)/i,
    'must not tell the session to fill worker-model and retry the same accepted report',
  );
});
