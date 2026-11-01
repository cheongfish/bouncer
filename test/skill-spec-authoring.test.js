'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../packages/cli/dist/frontmatter');
const { readSkill } = require('./helpers/read-skill');

const refsRoot = path.join(__dirname, '..', 'references', 'spec-authoring');
function refPath(name) {
  return path.join(refsRoot, name);
}

test('spec-authoring → has valid frontmatter identity', () => {
  const md = readSkill('spec-authoring');
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'spec-authoring');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('spec-authoring → ships completed reference examples', () => {
  for (const k of ['epic', 'blueprint']) {
    assert.ok(fs.existsSync(refPath(`${k}.md`)), k);
  }
});

test('spec-authoring Mermaid examples → keep each child zoom within its parent boxes', () => {
  const md = readSkill('spec-authoring');
  const charts = [...md.matchAll(/```mermaid\nflowchart LR\n([\s\S]*?)```/g)]
    .map(([, chart]) => new Set([...chart.matchAll(/\[[^\]]+\]/g)].map(([box]) => box)));

  assert.ok([...charts[1]].every((box) => charts[0].has(box)));
  assert.ok([...charts[2]].every((box) => charts[1].has(box)));
});

// rounds 예제는 validator 소스가 아니라 이 파일이 고정점이다. 스키마가 바뀌면
// 예제가 먼저 깨지게 해서 작성자가 형식을 역산하지 않게 한다.
test('spec-authoring review-rounds example → passes collectFindingFailures', () => {
  const { collectFindingFailures } = require('../packages/cli/dist/validate-sections');
  const { parseFrontmatter } = require('../packages/cli/dist/frontmatter');
  const md = fs.readFileSync(refPath('review-rounds.md'), 'utf8');
  const { data, body } = parseFrontmatter(md);
  const review = data.bouncer.review;
  assert.deepStrictEqual(collectFindingFailures({
    body, findings: review.findings, rounds: review.rounds,
    sectionLabel: 'review.md', findingLabel: 'review',
    allowedStatuses: ['resolved', 'accepted', 'deferred'], reviewStatus: 'accepted',
  }), []);
});

// 새 Checklist 규칙 두 항목은 기존 문장과 겹치는 낱말이 아니라 항목 전체 문장에 묶는다.
// 부분 정규식은 새 문장이 지워져도 통과하므로, 공백을 접은 본문에 문장 전체가 있는지와
// 문장을 지운 본문에 그 앞부분이 남지 않는지를 함께 본다.
const flatText = (text) => text.replace(/\s+/g, ' ');
const BRANCH_MATRIX_RULE = '- **Checklist** (branch matrix): Interface가 두 축 이상의 분기 matrix(예: perspective × tier)를 '
  + '제공하면 matrix의 셀마다 Checklist 항목을 하나씩 쓴다. 항목은 그 셀의 입력 값과 기대 결과를 literal로 적고, '
  + '"matrix 전체를 확인한다" 같은 묶음 항목 하나로 셀 단위를 대신하지 않는다.';
const DOC_WORDING_RULE = '- **Checklist** (doc wording): 문서·help 문구는 피할 수 있으면 단언하지 않고 존재·구조·링크를 '
  + '단언한다. 문구 자체가 계약이면 패턴이 새 문장의 처음부터 끝까지를 묶게 쓰고, 그 문장을 지우면 테스트가 '
  + '실패하는지 확인한다. 기존 문장과 겹치는 낱말 일부만 묶는 패턴은 문장을 지워도 통과한다.';

test('spec-authoring Checklist rules → carry the branch matrix and doc wording sentences whole', () => {
  const md = flatText(readSkill('spec-authoring'));
  for (const rule of [BRANCH_MATRIX_RULE, DOC_WORDING_RULE]) {
    assert.ok(md.includes(rule));
    assert.ok(!md.replace(rule, '').includes(rule.slice(0, 40)));
  }
  assert.doesNotMatch(md, /\blight/i);
});

// 신규 테스트의 tier 등록 경로는 최초 범위 확인에서 기록한다. 작성 지침과 계획 skill은 그 경로인
// test/tiers.json을 가리키고, 가리키는 파일이 저장소에 실제로 있어야 한다. 등록 누락 판정은 기존 G33
// (plan gate)이 맡으므로 여기서는 링크만 보고 판정 로직은 다시 검사하지 않는다.
test('spec-authoring tier rule → links test/tiers.json and the file exists', () => {
  assert.ok(readSkill('spec-authoring').includes('test/tiers.json'));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'test', 'tiers.json')));
});

test('bouncer-plan scope confirm → links test/tiers.json for each new test file', () => {
  assert.ok(readSkill('bouncer-plan').includes('test/tiers.json'));
});
