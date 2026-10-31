'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const DOCS = [
  'rules/cli.md',
  'rules/subagent-model.md',
  'skills/bouncer-run/references/agent-dispatch.md',
  'skills/bouncer-plan/references/context-review.md',
];

test('controller 문서 네 곳 중 하나라도 reviewer_tier를 빠뜨리면 → 파일 이름과 함께 실패한다', () => {
  for (const rel of DOCS) assert.match(read(rel), /reviewer_tier/, rel);
});

test('cli.md에 --tier 호출 형식이 없으면 → 실패한다', () => {
  assert.match(read('rules/cli.md'), /subagent-model --agent <name> --tier <tier>/);
});

test('subagent-model.md에 reviewer_tier_applied와 --tier 연결이 없으면 → 실패한다', () => {
  assert.match(
    read('rules/subagent-model.md'),
    /reviewer_tier_applied[\s\S]{0,200}--tier|--tier[\s\S]{0,200}reviewer_tier_applied/,
  );
});

test('워크플로 문서가 규칙 본문 참조를 빠뜨리면 → 파일 이름과 함께 실패한다', () => {
  for (const rel of DOCS.slice(2)) assert.match(read(rel), /rules\/subagent-model\.md/, rel);
});

test('context-review Metrics 문단이 tier·effort 전달을 빠뜨리면 → 실패한다', () => {
  const md = read('skills/bouncer-plan/references/context-review.md');
  const start = md.indexOf('**Metrics.**');
  const end = md.indexOf('3. **Merge**', start);
  assert.ok(start >= 0 && end > start, 'Metrics 문단 경계 없음');
  const metrics = md.slice(start, end);
  assert.match(metrics, /--tier <tier>/);
  assert.match(metrics, /--effort <effort>/);
  assert.match(metrics, /reviewer_tier_applied[\s\S]{0,200}--tier <reviewer_tier>/);
  assert.match(metrics, /drive-metrics\.md/);
});

test('agent-dispatch의 reviewer 두 항목 → --strategy와 --reviewer-tier를 함께 적는다', () => {
  // 두 reviewer 항목은 "- **" 머리글로 시작한다. 항목 본문 사이에서 다음 항목 머리글까지 잘라 검사한다.
  const md = read('skills/bouncer-run/references/agent-dispatch.md');
  for (const heading of ['- **Reviewer, per task.**', '- **Reviewer, final review.**']) {
    const start = md.indexOf(heading);
    assert.ok(start >= 0, `${heading} 항목 없음`);
    const end = md.indexOf('\n- **', start + heading.length);
    const entry = md.slice(start, end > start ? end : undefined);
    assert.match(entry, /--strategy[\s\S]{0,200}--reviewer-tier/, heading);
  }
});
