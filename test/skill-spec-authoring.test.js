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

test('document-schema states tags are the domain search vocabulary', () => {
  const root = path.join(__dirname, '..');
  const schema = fs.readFileSync(path.join(root, 'rules/document-schema.md'), 'utf8');
  assert.match(schema, /tags[\s\S]{0,300}(search label|search vocabulary|graph-suggest)/i);
  assert.match(schema, /\[A-Za-z0-9_\.\/-\]/);
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
  assert.match(md, /Never put a chart in `verification\.md` or `review\.md`/i);
});

test('spec-authoring Mermaid examples keep each child zoom within its parent boxes', () => {
  const md = readSkill('spec-authoring');
  const charts = [...md.matchAll(/```mermaid\nflowchart LR\n([\s\S]*?)```/g)]
    .map(([, chart]) => new Set([...chart.matchAll(/\[[^\]]+\]/g)].map(([box]) => box)));

  assert.ok([...charts[1]].every((box) => charts[0].has(box)));
  assert.ok([...charts[2]].every((box) => charts[1].has(box)));
});

// 계획 작성 근거는 재접지 --for + preflight. 전량 --all stdout 소비 문구는 두지 않는다.
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

test('spec-authoring writes explicit task dependency and parallel-ready frontmatter', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /depends_on/);
  assert.match(md, /parallel_safe/);
  assert.match(md, /dependency_gate/);
  assert.match(md, /TASKS-\d{3}|TASKS-NNN/);
  assert.match(md, /dependency_gate[\s\S]{0,10}integrated/);
  // 작성 참조가 거절된 gate 값을 예시로도 노출하지 않는다.
  assert.doesNotMatch(md, /integration-verified/);
  assert.match(md, /boolean|불리언|true|false/);
});

// review_risk는 Plan author가 Interface·Touch 근거로 확정한다. 위험이 없으면 []를
// 명시하고, 필드가 있어도 affected_paths·status·gate를 자동 승인하지 않는다.
test('spec-authoring requires review_risk enum with empty-array and grounding rules', () => {
  const md = readSkill('spec-authoring');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'rules/document-schema.md'), 'utf8');
  assert.match(md, /review_risk/);
  assert.match(schema, /review_risk/);
  for (const value of [
    'public_interface',
    'authentication',
    'authorization',
    'credential',
  ]) {
    assert.match(md, new RegExp(value));
    assert.match(schema, new RegExp(value));
  }
  // 위험 없음은 필드 생략이 아니라 빈 배열을 쓴다(신규 작성).
  assert.match(md, /review_risk[\s\S]{0,200}\[\]|`\[\]`[\s\S]{0,80}review_risk/);
  // Interface·Touch가 공개 API·인증·권한·credential을 말할 때 enum을 빠짐없이 기록.
  assert.match(
    md,
    /Interface[\s\S]{0,200}Touch[\s\S]{0,200}review_risk|review_risk[\s\S]{0,200}Interface[\s\S]{0,120}Touch/i,
  );
  // 자동 승인이 아님을 긍정 문구로 고정.
  assert.match(
    md,
    /(?:does not|do not|never|not)[\s\S]{0,100}(?:auto(?:matic(?:ally)?)?|자동)[\s\S]{0,80}(?:approv|승인|affected_paths|gate)|(?:affected_paths|status|gate)[\s\S]{0,100}(?:does not|do not|never|not)[\s\S]{0,60}(?:auto|자동)/i,
  );
  // legacy 부재는 []로 읽고, 신규 malformed만 S30 — document-schema가 제품 정본.
  assert.match(schema, /legacy|absent|부재/i);
  assert.match(schema, /S30/);
});

test('spec-authoring consumes resolver-selected intent evidence without promotion', () => {
  const md = readSkill('spec-authoring');
  assert.doesNotMatch(md, /distill/i);
  assert.match(md, /intent evidence/);
  assert.match(md, /historical/);
  assert.doesNotMatch(md, /context-search/);
  assert.match(md, /explain-diff/);
  assert.match(md, /Korean bodies/);
});

// 여덟 절·Touch 표·모호성 금지·full 전환 네 조건은 tasks 항목과 plan Light
// authoring scope가 함께 실어야 작성자와 구현자가 같은 계약을 본다.
test('spec-authoring tasks item carries eight-section rules and full-return signals', () => {
  const md = readSkill('spec-authoring');
  const item = md.slice(md.indexOf('- **tasks**'), md.indexOf('- **verification / review**'));
  assert.match(item, /Current behavior[\s\S]*Target behavior/);
  assert.match(item, /reproduc/i);
  assert.match(item, /success[\s\S]{0,120}failure[\s\S]{0,120}preserv/i);
  assert.match(item, /경로 \| 심볼 \| 변경 \| 현재 책임 \| 계획한 변경 \| 근거/);
  assert.match(item, /신규 추출 지점/);
  assert.match(item, /적절히 처리한다/);
  assert.match(item, /discovery task/i);
  assert.match(item, /dry-run/);
  const full4 = /public interface[\s\S]{0,300}protected path[\s\S]{0,300}error contract[\s\S]{0,300}multiple modules/i;
  assert.match(item, full4);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'skills/bouncer-plan/SKILL.md'), 'utf8'), full4);
});

// tasks 항목의 seam·throw/miss·I/O 관찰·기대 red·staging·verify 구분·domain term
// 규칙은 예시 tasks.md와 함께 고정한다. 규칙 문장 삭제나 예시 모순을 회귀로 잡는다.
test('spec-authoring tasks item requires seam, throw/miss, expected red, and staging rules', () => {
  const md = readSkill('spec-authoring');
  const item = md.slice(md.indexOf('- **tasks**'), md.indexOf('- **verification / review**'));
  assert.match(item, /call count[\s\S]{0,200}injection parameter[\s\S]{0,120}shape/i);
  assert.match(item, /throw[\s\S]{0,200}(cache miss|fallback)[\s\S]{0,120}separate/i);
  assert.match(item, /process spawn[\s\S]{0,200}`file:line`/i);
  assert.match(item, /expected failing assertion|expected red/i);
  assert.match(item, /module-load failure/i);
  assert.match(item, /npm run build[\s\S]{0,80}git add[\s\S]{0,80}check:emit/);
  assert.match(item, /bouncer\.verify[\s\S]{0,200}execute gate/i);
  assert.match(item, /domain term[\s\S]{0,200}shape[\s\S]{0,80}example/i);
  assert.match(item, /`git add` is allowed[\s\S]{0,120}(commit|push|branch)/i);
  assert.doesNotMatch(md, /^## (Context|Done)$/m);
  const example = fs.readFileSync(refPath('tasks.md'), 'utf8');
  assert.match(example, /^## Interface\n[\s\S]*throw[\s\S]*fallback[\s\S]*?\n## Touch/m);
  assert.match(example, /^## Checklist\n[\s\S]*기대 red/m);
});

// 제품 규칙 위치와 light 예산은 planning 정본을 가리킨다. governance를 다시
// 계획 정본으로 쓰면 BP2 이전 회귀다.
test('spec-authoring cites rules/planning.md for product rules and light budget', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /rules\/planning\.md/);
  assert.match(md, /rules\/document-schema\.md/);
  assert.match(md, /rules\/planning\.md`?\s*`?## Lightweight cycle/);
  assert.doesNotMatch(md, /rules\/governance\.md/);
});

// verification task의 scaffold Touch 고정 문구를 작성 단계에서 바꾸지 않게 한다(G20 예방).
test('spec-authoring keeps the scaffolded verification Touch phrase', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /Source 변경 경로 없음\./);
});
