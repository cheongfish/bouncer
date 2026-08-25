'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

const refsRoot = path.join(__dirname, '..', 'skills', 'spec-authoring', 'references');
function refPath(name) {
  return path.join(refsRoot, name);
}

test('spec-authoring has valid frontmatter identity', () => {
  const md = readSkill('spec-authoring');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*spec-authoring/);
  assert.strictEqual(data.name, 'spec-authoring');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('spec-authoring documents frontmatter ownership and five task sections', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /frontmatter/i);
  assert.match(md, /Goal & intent|Interface|Touch|Do not touch|Checklist/i);
});

test('spec-authoring ties document titles to commit messages via .gitmessage', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /\.gitmessage/);
  assert.match(md, /title/i);
  assert.match(md, /commit_intent/);
  assert.match(md, /commit_type|\/bouncer-commit|\/bouncer-finalize|finalize/i);
  // task 커밋 subject는 task title; task commit_intent(2줄)도 표에 있다.
  assert.match(md, /tasks`?\s*`?bouncer\.commit_intent|task.*commit_intent/i);
  assert.match(md, /tasks`?\s*`?title|task `title`/i);
});


test('spec-authoring documents project Distill promotion and defers explain to explain-diff', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /\.bouncer\/Distill\.md/);
  assert.match(md, /Invariants|Gotchas|Decisions/);
  assert.match(md, /current|현재/i);
  assert.match(md, /explain-diff/);
  assert.doesNotMatch(md, /scaffold distill/);
  assert.doesNotMatch(md, /author.*explain\.md|Write.*explain\.md/i);
});

test('spec-authoring promotes from explain.md and excludes 이해 상태', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /explain\.md/);
  assert.match(md, /이해 상태/); // 제외 대상 언급
  assert.match(md, /승격하지 않|옮기지 않|제외/);
});

test('spec-authoring requires Korean plan bodies, English Distill, and stop-slop', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /Korean/);
  assert.match(md, /English/);
  assert.match(md, /\.bouncer\/Distill\.md/);
  assert.match(md, /stop-slop/);
  assert.match(md, /skills\/stop-slop\/SKILL\.md/);
});

test('spec-authoring ships completed reference examples and points SKILL.md at them', () => {
  for (const k of ['epic', 'blueprint', 'tasks', 'review']) {
    assert.ok(fs.existsSync(refPath(`${k}.md`)), k);
  }
  assert.match(readSkill('spec-authoring'), /references\//);
});

test('spec-authoring documents optional Mermaid zoom with short unstyled Korean examples', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /mermaid/i);
  assert.match(md, /줌|zoom/i);
  assert.match(md, /epic.*whole flow|whole flow.*epic/i);
  assert.match(md, /blueprint.*PR.*segment|PR.*segment.*blueprint/i);
  assert.match(md, /tasks.*implementation branch|implementation branch.*tasks/i);
  assert.match(md, /classDef[\s\S]{0,80}prohibited|prohibited[\s\S]{0,80}classDef/i);
  assert.match(md, /colors[\s\S]{0,80}prohibited|prohibited[\s\S]{0,80}colors/i);
  assert.match(md, /long node ids[\s\S]{0,80}prohibited|prohibited[\s\S]{0,80}long node ids/i);
  assert.match(md, /Never put a chart in Distill/i);
  assert.match(md, /verification\.md/);
  assert.match(md, /review\.md/);
});

test('spec-authoring Mermaid examples keep each child zoom within its parent boxes', () => {
  const md = readSkill('spec-authoring');
  const charts = [...md.matchAll(/```mermaid\nflowchart LR\n([\s\S]*?)```/g)]
    .map(([, chart]) => new Set([...chart.matchAll(/\[[^\]]+\]/g)].map(([box]) => box)));

  assert.ok([...charts[1]].every((box) => charts[0].has(box)));
  assert.ok([...charts[2]].every((box) => charts[1].has(box)));
});

test('spec-authoring tasks section binds description, commit_intent, and Checklist roles', () => {
  // 같은 변경을 title·description·commit_intent·Goal·Interface에 다섯 번 쓰지 않도록
  // 역할 경계 세 줄을 긍정 매치로 고정한다. 금지 문구의 부재 단언은 쓰지 않는다 —
  // 게이트가 검사하는 것은 섹션 존재이지 진술 횟수가 아니다.
  const body = readSkill('spec-authoring');
  assert.match(body, /description[\s\S]{0,120}Goal & intent[\s\S]{0,80}(유도|첫 문장)/);
  assert.match(body, /commit_intent[\s\S]{0,160}(커밋 메시지 생성 전용|SSOT)/);
  assert.match(body, /Checklist[\s\S]{0,160}Touch[\s\S]{0,80}(다시 열거하지|재열거하지)/);
});

// 계획 작성 근거는 재접지 --for + preflight. 전량 --all stdout 소비 문구는 두지 않는다.
test('spec-authoring plan-time Distill uses preflight and --for, not complete --all stdout', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /--preflight/);
  assert.match(md, /baseline/);
  assert.match(md, /distill\s+--for|--for/);
  assert.doesNotMatch(md, /complete `bouncer distill --all` output/);
});

test('spec-authoring derives a shard-targeted proposal and writes only after consent', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /drop[\s\S]{0,80}replace[\s\S]{0,80}add/i);
  assert.match(md, /bullet|불릿/);
  assert.match(md, /source|출처.*explain|explain.*절/i);
  assert.match(md, /target shard|대상 샤드|shard id/i);
  assert.match(md, /audit\.shards/);
  assert.match(md, /consent|동의|승인/);
  assert.match(md, /only after|after.*consent|동의.*(?:이후|뒤).*쓴|동의.*쓰기/i);
  assert.match(md, /current body|현재 본문|body content/);
  assert.match(md, /registered relative path|등재.*상대 경로/i);
  // 승격 맵은 finalize가 payload content를 갈라 넘긴 것이지, 샤드 파일 재읽기가 아니다.
  assert.match(md, /payload[\s\S]{0,80}(?:content|derived|유래)|content[\s\S]{0,80}(?:split|갈라|분해)/i);
  assert.doesNotMatch(
    md,
    /reads each registered shard separately|각 등록(?:된)? 샤드를 따로 읽/,
  );
  assert.match(md, /single-file/);
  assert.match(md, /never invoke.*route|never invokes route|route.*자체/);
  assert.match(md, /caller-supplied|caller-provided|호출자.*(?:제공|넘긴)/i);
  assert.match(md, /aggregate|selection|합산|선택 결과/i);
  assert.match(md, /never[^\n]{0,120}(?:attach|associate|individual shard|개별 샤드)/i);
  assert.doesNotMatch(md, /scripts\/bouncer|BOUNCER_ROOT/);
});
