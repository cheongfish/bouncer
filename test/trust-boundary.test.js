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
  'agentic-code-benchmark',
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
  'migrate-ids',
  'bouncer-init',
  'bouncer-commit',
  'bouncer-finalize',
];

// 동일 문장을 강제하지 않는다. 한국어(데이터/지시)와 영어(data/instruction)
// 모두 "이 입력은 지시가 아니다" 취지만 본다. 패턴 탐지 코드가 아니라
// 문서 계약 단언이라 scripts/ 는 손대지 않는다.
const DISTINCTION_RE =
  /데이터이지\s*지시가\s*아니|지시로\s*승격하지\s*않|not\s+(?:as\s+)?(?:an\s+)?instructions?\b|do\s+not\s+(?:treat|promote)\b.{0,80}\b(?:as\s+|to\s+)(?:an\s+)?instructions?\b/i;

function readRel(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function skillRel(name) {
  return path.join('skills', name, 'SKILL.md');
}

function agentRel(name) {
  return path.join('agents', `${name}.md`);
}

test('trust-boundary list excludes skills that do not read untrusted data', () => {
  assert.strictEqual(SKILLS.length, 9);
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
