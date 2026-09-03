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

test('governance defines Lightweight cycle contract', () => {
  const gov = read('rules/governance.md');
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
  // scaffold default full → on light, change the value only (do not add/remove the key).
  assert.match(plan, /scale:\s*full/);
  assert.match(plan, /change the value to `light`/);
  assert.doesNotMatch(plan, /schema\.ts에 등록하지 않/);
  assert.doesNotMatch(plan, /키 자체를 넣지 않는다/);
});

test('governance light path flips full to light instead of omitting the key', () => {
  const gov = read('rules/governance.md');
  assert.match(gov, /no automatic sizing/i);
  assert.match(gov, /scaffold\s+default\s+`full`\s+to\s+`light`/);
  assert.match(gov, /back to `full`/);
  // 키 자체를 빼는 방식으로 되돌아가지 않는다 — 값만 뒤집는다.
  assert.doesNotMatch(gov, /omit(ting)? the key|키를 쓰지 않/i);
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

test('governance defines the light plan document set and gate branch', () => {
  const gov = read('rules/governance.md');
  assert.match(gov, /--scale light/);
  assert.match(gov, /context-review\.md/);
  assert.match(gov, /\bG18\b/);
  assert.match(gov, /\bG10\b/);
  assert.match(gov, /100 lines or fewer/);
  assert.match(gov, /`Goal & intent`, `Touch`,\s+and `Checklist`/);
  // 승인 범위 게이트는 그대로다.
  assert.match(gov, /G3[–-]G5/);
  assert.match(gov, /\bG11\b/);
  assert.match(gov, /\bG12\b/);
  assert.match(gov, /exit code 2/);
});

test('docs record the light plan contract in one voice', () => {
  assert.match(read('docs/cli.md'), /--scale light\\\|full/);
  assert.match(read('docs/gates.md'), /light 3개: Goal & intent·Touch·Checklist/);
  assert.match(read('docs/gates.md'), /G18을 적용하지 않는다/);
  assert.match(read('docs/workflow.md'), /--scale light/);
  assert.match(read('docs/workflow.md'), /full로 돌아가려면/);
  assert.match(read('docs/ARCHITECTURE.md'), /full plan 하나뿐이다/);
  assert.match(read('docs/troubleshooting.md'), /light`는 Goal & intent·Touch·Checklist 셋/);
});

test('compatibility records the broken G10 and G18 contract', () => {
  const compat = read('docs/compatibility.md');
  assert.match(compat, /파기한 계약: light plan 문서 세트/);
  assert.match(compat, /\*\*왜\.\*\*/);
  assert.match(compat, /\*\*영향\.\*\*/);
  assert.match(compat, /\*\*대체 경로\.\*\*/);
  assert.match(compat, /scaffold context-review/);
});

test('spec-authoring documents the three light task sections', () => {
  const sa = read('references/spec-authoring/index.md');
  assert.match(sa, /light blueprint/);
  assert.match(sa, /Goal & intent, Touch,\s*\n?\s*Checklist/);
  assert.match(sa, /back to `full`/);
});
