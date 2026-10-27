'use strict';

// implementer 문서의 Guardrails에 "report 전 변경 파일 eslint 실행" 절차가 있는지 고정한다.
// 120자 규칙은 이미 문서에 있었지만 적용을 확인하는 절차가 없어 lint 위반이 종단 검증에서야 드러났다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/**
 * 문서의 `## Guardrails` 절 본문을 heading부터 다음 `## ` heading 직전까지 잘라 돌려준다.
 * 절이 없으면 빈 문자열을 돌려주어 호출 쪽 단언이 절 부재를 실패로 드러내게 한다.
 *
 * @param {string} markdown - implementer 역할 문서 전문
 * @returns {string} Guardrails 절 본문, 없으면 빈 문자열
 */
function guardrailsSection(markdown) {
  const start = markdown.indexOf('## Guardrails');
  if (start === -1) return '';
  const next = markdown.indexOf('\n## ', start + 1);
  return markdown.slice(start, next === -1 ? undefined : next);
}

test('implementer Guardrails → eslint run on changed files, no disable bypass, verify kept', () => {
  const section = guardrailsSection(read('agents/bouncer-implementer.md'));
  assert.ok(section.includes('npx eslint <changed'), 'eslint 실행 항목이 없다');
  assert.ok(section.includes('eslint-disable'), 'eslint-disable 우회 금지가 없다');
  assert.ok(section.includes('verify'), 'verify 명령을 대체하지 않는다는 문구가 없다');
});

test('implementer Codex TOML → carries the same eslint run step as the Markdown source', () => {
  const toml = read('.codex/agents/bouncer-implementer.toml');
  assert.ok(toml.includes('npx eslint <changed'), 'TOML 사본에 eslint 실행 항목이 없다');
});
