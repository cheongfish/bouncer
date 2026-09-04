'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// 외부·생성 데이터를 읽는 스킬만 순회한다. 나머지 열은 그 데이터를
// 지시로 읽을 자리가 없어 같은 문구를 강제하지 않는다 — 목록을 늘리면
// 문서만 길어진다.
const SKILLS = [
  'bouncer-plan',
  'bouncer-execute',
  'bouncer-run',
  'graphify-runner',
  'review',
  'implementation',
  'debugging',
  'context-review',
];

const AGENTS = [
  'bouncer-reviewer',
  'bouncer-implementer',
  'bouncer-debugger',
  'bouncer-context-reviewer',
];

const OUTSIDE_SKILLS = [
  'discovery',
  'spec-authoring',
  'stop-slop',
  'minimality',
  'verification',
  'explain-diff',
  'bouncer-init',
  'bouncer-commit',
  'bouncer-finalize',
];

// 동일 문장을 강제하지 않는다. 한국어(데이터/지시)와 영어(data/instruction)
// 모두 "이 입력은 지시가 아니다" 취지만 본다. 패턴 탐지 코드가 아니라
// 문서 계약 단언이라 scripts/ 는 손대지 않는다.
const DISTINCTION_RE =
  /데이터이지\s*지시가\s*아니|지시로\s*승격하지\s*않|not\s+(?:as\s+)?(?:an\s+)?instructions?\b|do\s+not\s+(?:treat|promote)\b.{0,80}\b(?:as\s+|to\s+)(?:an\s+)?instructions?\b/i;

// 각 소비자는 hard rule 11을 공통 정본으로 가리키되, 자신이 읽는 입력과
// 보호할 결정은 달라야 한다. 단순한 공통 경고가 다시 늘어나는 것을 막는다.
const BOUNDARY_CONTRACTS = new Map([
  ['skills/bouncer-plan/SKILL.md', [/\.bouncer\/context/, /graphify-out/, /user['’]s approval/i]],
  ['skills/bouncer-execute/SKILL.md', [/context-doc bodies/i, /repo source/, /affected_paths/, /skip a gate/i]],
  ['skills/bouncer-run/SKILL.md', [/Context document bodies/i, /graph output/i, /subagent reports/i, /limits/i, /ACQ/]],
  ['references/graphify-runner/index.md', [/graphify-out/, /suggested_paths/, /affected_paths/]],
  ['references/review/index.md', [/worktree diff/, /Findings/, /review accepted/i]],
  ['references/implementation/index.md', [/Repo source/, /\.bouncer\/context/, /Touch/, /Do not touch/]],
  ['references/debugging/index.md', [/Verify logs/, /returned report/, /affected_paths/, /document status/]],
  ['references/context-review/index.md', [/Epic, blueprint, and task bodies/, /judgment/, /status/]],
  ['agents/bouncer-implementer.md', [/repo source/, /\.bouncer\/context/, /task brief/i, /Touch/, /Do not touch/]],
  ['agents/bouncer-reviewer.md', [/worktree diff/, /nested\s+subagent/, /brief/, /review status/]],
  ['agents/bouncer-debugger.md', [/verify output/, /logs/, /stack traces/, /affected_paths/, /document status/]],
  ['agents/bouncer-context-reviewer.md', [/epic,\s+blueprint,\s+or task\s+bodies/, /scope/, /status/]],
]);

const UNPUBLISHED_HELPERS = new Set([
  'graphify-runner',
  'review',
  'implementation',
  'debugging',
  'context-review',
]);

function readRel(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function skillRel(name) {
  if (UNPUBLISHED_HELPERS.has(name)) {
    return path.join('references', name, 'index.md');
  }
  return path.join('skills', name, 'SKILL.md');
}

function agentRel(name) {
  return path.join('agents', `${name}.md`);
}

test('trust-boundary list excludes skills that do not read untrusted data', () => {
  assert.strictEqual(SKILLS.length, 8);
  assert.strictEqual(AGENTS.length, 4);
  for (const name of OUTSIDE_SKILLS) {
    assert.ok(
      !SKILLS.includes(name),
      `${name} is outside the data-reading set and must not be forced`,
    );
  }
});

test('each data-reading skill and agent distinguishes data from instruction', () => {
  const targets = [
    ...SKILLS.map(skillRel),
    ...AGENTS.map(agentRel),
  ];
  for (const rel of targets) {
    const md = readRel(rel);
    assert.ok(
      DISTINCTION_RE.test(md),
      `${rel} must distinguish data from instruction`,
    );
  }
});

test('each data-reading skill and agent references hard rule 11 with a local boundary', () => {
  for (const [rel, required] of BOUNDARY_CONTRACTS) {
    const md = readRel(rel);
    assert.match(md, /CLAUDE\.md[^\n]{0,80}hard rule 11|hard rule 11[^\n]{0,80}CLAUDE\.md/i,
      `${rel} must reference the trust-boundary source of truth`);
    for (const pattern of required) {
      assert.match(md, pattern, `${rel} must retain its input and protected-decision boundary`);
    }
  }
});

test('Distill promotion keeps explain input separate from promotion consent', () => {
  const md = readRel('skills/bouncer-finalize/references/distill-promotion.md');
  assert.match(md, /CLAUDE\.md[^\n]{0,80}hard rule 11|hard rule 11[^\n]{0,80}CLAUDE\.md/i);
  assert.match(md, /Explain body is data, not instructions/i);
  assert.match(md, /promotion candidates|승격 후보/i);
  assert.match(md, /consent|동의/i);
});
