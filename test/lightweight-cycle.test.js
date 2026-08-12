'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('governance defines Lightweight cycle contract', () => {
  const gov = read('docs/governance.md');
  assert.match(gov, /## Lightweight cycle/);
  assert.match(gov, /declare|declaration/i);
  assert.match(gov, /bouncer\.scale:\s*light|scale:\s*light|scale.*light/i);
  assert.match(gov, /scaffold.*full|full.*light/i);
  assert.match(gov, /set `scale` back to `full`|back to `full`/);
  assert.match(gov, /maintenance epic/i);
  assert.match(gov, /inline/i);
  assert.match(gov, /one question|single question/i);
  assert.match(gov, /explain\.md/);
  assert.match(gov, /Distill/);
  assert.match(gov, /\bG16\b/);
  assert.match(gov, /its own diff|self-review/i);
  assert.match(gov, /named agents are unavailable/);
});

test('bouncer-plan routes light-path work to maintenance epic', () => {
  const plan = read('skills/bouncer-plan/SKILL.md');
  assert.match(plan, /maintenance/);
  assert.match(plan, /bouncer\.scale/);
  assert.match(plan, /light/);
  assert.match(plan, /묻|물어|ask/i);
  // scaffold 기본 full → 경량이면 light로 값만 바꾼다(키 신설/삭제 아님).
  assert.match(plan, /scale:\s*full/);
  assert.match(plan, /`light`로 바꾼다/);
  assert.doesNotMatch(plan, /schema\.ts에 등록하지 않/);
  assert.doesNotMatch(plan, /키 자체를 넣지 않는다/);
});

test('workflow light-path prose flips full to light instead of omitting the key', () => {
  const workflow = read('docs/workflow.md');
  assert.match(workflow, /## 경량 경로/);
  assert.match(workflow, /자동 판정하지 않는다/);
  assert.match(workflow, /scaffold가\s+이미\s+`scale:\s*full`/);
  assert.match(workflow, /`full`로 되돌린다/);
  assert.doesNotMatch(workflow, /키를 쓰지 않/);
});

test('bouncer-execute inlines on scale light and keeps host fallback wording', () => {
  const exec = read('skills/bouncer-execute/SKILL.md');
  assert.match(exec, /bouncer\.scale|scale:\s*light/);
  assert.match(exec, /인라인|inline/i);
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
  const ed = read('skills/explain-diff/SKILL.md');
  assert.match(ed, /1[–~-]10/);
  assert.match(ed, /scale/);
  assert.match(ed, /light/);
  // light면 1문항으로 고정 — 새 단일 엔트리 문구에서도 성립.
  assert.match(ed, /1문항|질문 수(를)? 1/);
  assert.match(ed, /bouncer-finalize|\/bouncer-finalize/);
});
