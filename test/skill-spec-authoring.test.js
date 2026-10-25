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
