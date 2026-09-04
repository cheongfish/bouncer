'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

const refsRoot = path.join(__dirname, '..', 'references', 'spec-authoring');
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

test('spec-authoring ties document titles to commit messages via .gitmessage', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /\.gitmessage/);
  assert.match(md, /title/i);
  assert.match(md, /commit_intent/);
  assert.match(md, /commit_summary/);
  assert.match(md, /commit_type|\/bouncer-commit|\/bouncer-finalize|finalize/i);
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
  assert.match(md, /references\/stop-slop\/index\.md/);
});

test('spec-authoring separates Korean reader prose from ASCII discovery fields', () => {
  const md = readSkill('spec-authoring');
  const language = md.match(/^## Language and prose\n[\s\S]*?(?=^## )/m)[0];
  assert.match(language, /title[\s\S]{0,120}Korean/i);
  assert.match(language, /description[\s\S]{0,120}English ASCII/i);
  assert.match(language, /tags[\s\S]{0,120}English ASCII/i);
  assert.match(language, /tags[\s\S]{0,300}domain/i);
  assert.match(language, /stop-slop[\s\S]{0,180}(reader-facing|독자).*prose/i);
  assert.match(language, /stop-slop[\s\S]{0,180}(derived anchors|search metadata)/i);
  assert.match(language, /bulk-rewrite the existing corpus/i);
});

test('okf states tags are the domain search vocabulary', () => {
  const root = path.join(__dirname, '..');
  const okf = fs.readFileSync(path.join(root, 'rules/okf.md'), 'utf8');
  assert.match(okf, /tags[\s\S]{0,300}(search label|search vocabulary|graph-suggest)/i);
  assert.match(okf, /\[A-Za-z0-9_\.\/-\]/);
  assert.doesNotMatch(okf, /Wave 2 context-digest will generate/);
});

test('spec-authoring ships completed reference examples and points SKILL.md at them', () => {
  for (const k of ['epic', 'blueprint']) {
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
  assert.match(md, /classDef[\s\S]{0,80}prohibited|prohibited[\s\S]{0,80}classDef/i);
  assert.match(md, /colors[\s\S]{0,80}prohibited|prohibited[\s\S]{0,80}colors/i);
  assert.match(md, /long node ids[\s\S]{0,80}prohibited|prohibited[\s\S]{0,80}long node ids/i);
  assert.match(md, /Never put a chart in Distill/i);
});

test('spec-authoring Mermaid examples keep each child zoom within its parent boxes', () => {
  const md = readSkill('spec-authoring');
  const charts = [...md.matchAll(/```mermaid\nflowchart LR\n([\s\S]*?)```/g)]
    .map(([, chart]) => new Set([...chart.matchAll(/\[[^\]]+\]/g)].map(([box]) => box)));

  assert.ok([...charts[1]].every((box) => charts[0].has(box)));
  assert.ok([...charts[2]].every((box) => charts[1].has(box)));
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

// author-written frontmatter: YAML 예약 지시자 선두 값은 평문 scalar 금지.
// 문구 고정이 아니라 위험 입력·안전 형식·범위 제외의 식별자만 본다.
test('spec-authoring keeps identifiers out of titles, commit_intent, and commit_summary', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /out of titles[\s\S]{0,80}commit_intent[\s\S]{0,40}commit_summary/i);
});

test('spec-authoring quotes YAML-leading reserved characters in author-written scalars', () => {
  const md = readSkill('spec-authoring');
  // 위험 입력: 선두 백틱 / YAML 예약 지시자
  assert.match(md, /예약 지시자|reserved (?:indicator|character)/i);
  assert.match(md, /백틱|backtick/i);
  assert.match(md, /선두|leading/i);
  // 안전 형식: 작은따옴표 또는 block scalar
  assert.match(md, /작은따옴표|single[- ]quot/i);
  assert.match(md, /block scalar|>-/i);
  // 적용 대상 식별자 (author-written)
  assert.match(md, /commit_intent/);
  // 작은따옴표 안의 작은따옴표는 '' 로 이스케이프
  assert.match(md, /''/);
  // 범위 제외를 긍정 문구로 고정 — 본문·중간 백틱까지 넓히지 않는다
  assert.match(md, /중간/);
  assert.match(md, /본문/);
  assert.match(md, /금지하지 않|does not (?:ban|forbid|prohibit)|not required/i);
});
