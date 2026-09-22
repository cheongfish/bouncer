'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { readWorkflowBundle } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('planning defines Lightweight cycle contract', () => {
  const planning = read('rules/planning.md');
  assert.match(planning, /## Lightweight cycle/);
  assert.match(planning, /declare|declaration/i);
  assert.match(planning, /bouncer\.scale:\s*light|scale:\s*light|scale.*light/i);
  assert.match(planning, /scaffold.*full|full.*light/i);
  assert.match(planning, /set `scale` back to `full`|back to `full`/);
  assert.match(planning, /maintenance epic/i);
  assert.match(planning, /explain\.md/);
  assert.doesNotMatch(planning, /distill/i);
  assert.match(planning, /\bG16\b/);
  // BP3 실행 문장(inline·quiz·self-review)은 governance 잔여 절이 소유한다.
  assert.doesNotMatch(planning, /named agents are unavailable/);
});

test('governance keeps light execution contracts after planning extraction', () => {
  const gov = read('rules/governance.md');
  assert.match(gov, /## Lightweight cycle/);
  assert.match(gov, /inline/i);
  assert.match(gov, /one question|single question/i);
  assert.match(gov, /its own diff|self-review/i);
  assert.match(gov, /named agents are unavailable/);
});

test('bouncer-plan routes light-path work to maintenance epic', () => {
  const plan = read('skills/bouncer-plan/SKILL.md');
  assert.match(plan, /maintenance/);
  assert.match(plan, /bouncer\.scale/);
  assert.match(plan, /light/);
  assert.match(plan, /묻|물어|ask/i);
  // scaffold default full → on light, change the value only (do not add/remove the key).
  assert.match(plan, /scale:\s*full/);
  assert.match(plan, /change the value to `light`/);
  assert.doesNotMatch(plan, /schema\.ts에 등록하지 않/);
  assert.doesNotMatch(plan, /키 자체를 넣지 않는다/);
});

test('planning light path flips full to light instead of omitting the key', () => {
  const planning = read('rules/planning.md');
  assert.match(planning, /no automatic sizing/i);
  assert.match(planning, /scaffold\s+default\s+`full`\s+to\s+`light`/);
  assert.match(planning, /back to `full`/);
  // 키 자체를 빼는 방식으로 되돌아가지 않는다 — 값만 뒤집는다.
  assert.doesNotMatch(planning, /omit(ting)? the key|키를 쓰지 않/i);
});

test('bouncer-execute inlines implementer on scale light and keeps host fallback wording', () => {
  const exec = readWorkflowBundle('bouncer-execute');
  assert.match(
    exec,
    /When the pointer \(`bouncer current`\) `scale` is `light`/,
  );
  assert.match(exec, /인라인|inline/i);
  // Review stays named on light — no step-5 light inline read-only branch.
  assert.doesNotMatch(
    exec,
    /`scale` is `light`[\s\S]{0,200}inline read-only/,
  );
  assert.match(exec, /named agents are unavailable/);
  assert.match(exec, /\bG8\b/);
  assert.match(exec, /bouncer-debugger/);
  // light branch must not OR onto the host-fallback sentence
  assert.doesNotMatch(
    exec,
    /named agents are unavailable[\s\S]{0,120}lightweight cycle/i,
  );
});

test('explain-diff fixes one quiz question on scale light', () => {
  const ed = read('references/explain-diff/index.md');
  assert.match(ed, /1[–~-]10/);
  assert.match(ed, /scale/);
  assert.match(ed, /light/);
  // light면 1문항으로 고정 — 새 단일 엔트리 문구에서도 성립.
  assert.match(ed, /1문항|질문 수(를)? 1/);
  assert.match(ed, /bouncer-finalize|\/bouncer-finalize/);
});

test('planning defines the light plan document set and gate branch', () => {
  const planning = read('rules/planning.md');
  assert.match(planning, /--scale light/);
  assert.match(planning, /context-review\.md/);
  assert.match(planning, /\bG18\b/);
  assert.match(planning, /\bG10\b/);
  assert.match(planning, /100 lines or fewer/);
  assert.match(planning, /`Goal & intent`, `Touch`,\s+and `Checklist`/);
  // 승인 범위 게이트는 그대로다.
  assert.match(planning, /G3[–-]G5/);
  assert.match(planning, /\bG11\b/);
  assert.match(planning, /\bG12\b/);
  assert.match(planning, /exit code 2/);
});

test('spec-authoring documents the three light task sections', () => {
  const sa = read('references/spec-authoring/index.md');
  assert.match(sa, /light blueprint/);
  assert.match(sa, /Goal & intent, Touch,\s*\n?\s*Checklist/);
  assert.match(sa, /back to `full`/);
});

test('plan execute and run keep declaration-driven light routing', () => {
  const plan = read('skills/bouncer-plan/SKILL.md');
  const exec = readWorkflowBundle('bouncer-execute');
  const run = read('skills/bouncer-run/SKILL.md');
  assert.match(plan, /do not auto-judge/);
  assert.match(plan, /Skip this entire step when the blueprint's\n\s*`bouncer\.scale` is `light`/);
  assert.match(exec, /When the pointer \(`bouncer current`\) `scale` is `light`/);
  assert.match(run, /do not use execute's inline branch during a drive/);
});

// light는 execute 안의 인라인 분기일 뿐 드라이브 형태를 바꾸지 않는다.
// 별도 execution_mode opt-in을 만들면 두 실행 경로가 갈라진다.
test('a light blueprint still runs through the coordinator inside a drive', () => {
  const run = read('skills/bouncer-run/SKILL.md');
  const exec = readWorkflowBundle('bouncer-execute');
  assert.match(run, /named `bouncer-coordinator`/);
  assert.match(run, /Even when the blueprint was declared light,\s*\n?\s*do not use execute's inline branch during a drive/);
  assert.match(exec, /`\/bouncer-run` always retains the named orchestration boundary/);
  // 위임은 blueprint 선언이 아니라 /bouncer-run 진입으로 정해진다.
  for (const md of [run, exec, read('rules/governance.md')]) {
    assert.doesNotMatch(md, /execution_mode/);
  }
});
