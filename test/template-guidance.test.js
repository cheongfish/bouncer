'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

/**
 * 저장소 루트 기준 Markdown을 UTF-8로 읽는다.
 * 호출마다 디스크에서 읽어, 이전 단언이 캐시한 본문으로 후속 단언이 통과하지 않게 한다.
 *
 * @param {string} rel - 저장소 루트 상대 경로
 * @returns {string} 파일 원문
 */
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/**
 * 정규식에 넣을 표식 문자열을 이스케이프한다.
 *
 * @param {string} value - 표식 또는 들여쓰기
 * @returns {string} RegExp 생성에 안전한 패턴
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * bullet 표식부터 같은 들여쓰기의 다음 표식 직전까지 자른다.
 * 중첩 목록이 같은 `- **` 이름을 가져도 들여쓰기가 다르면 경계를 넘지 않는다.
 *
 * @param {string} text - 자를 Markdown 원문
 * @param {string} marker - 항목 시작 표식
 * @param {string} nextPrefix - 같은 들여쓰기에서 끝을 알리는 접두
 * @returns {{at: number, item: string}} 표식 위치와 자른 항목. 없으면 at는 -1
 */
function sliceSameIndent(text, marker, nextPrefix = '- **') {
  const at = text.indexOf(marker);
  if (at < 0) return { at, item: '' };
  const lineStart = text.lastIndexOf('\n', at - 1) + 1;
  const indent = text.slice(lineStart, at);
  const after = at + marker.length;
  const next = text.slice(after).search(new RegExp(`\\n${escapeRegExp(indent)}${escapeRegExp(nextPrefix)}`));
  return { at, item: next < 0 ? text.slice(at) : text.slice(at, after + next) };
}

/**
 * 2절 Contract 본문만 남긴다. 3절 이후 판정 절차에 있는 단어로 (f)가 통과하지 않게 한다.
 *
 * @param {string} text - review 또는 context-review 원문
 * @returns {string} `2. **Contract**`부터 `3. **` 직전
 */
function contractSection(text) {
  const start = text.indexOf('2. **Contract**');
  const end = text.indexOf('3. **', start);
  return text.slice(start, end < 0 ? undefined : end);
}

/**
 * fingerprint가 처음 나오는 줄부터 같은 들여쓰기의 다음 `- ` 직전까지 자른다.
 * 출력 계약의 다른 필드(summary·origin)가 정규화 단언을 대신 맞추지 못하게 한다.
 *
 * @param {string} text - agent 원문
 * @returns {string} fingerprint 목록 항목 조각
 */
function firstFingerprintItem(text) {
  const hit = text.indexOf('fingerprint');
  if (hit < 0) return '';
  const lineStart = text.lastIndexOf('\n', hit) + 1;
  const indent = text.slice(lineStart).match(/^ */)[0];
  const next = text.slice(lineStart).search(new RegExp(`\\n${escapeRegExp(indent)}- `));
  return next < 0 ? text.slice(lineStart) : text.slice(lineStart, lineStart + next);
}

test('template guidance a–f lives in spec-authoring, review, and reviewer agents', () => {
  const spec = read('references/spec-authoring/index.md');
  const blueprintItem = sliceSameIndent(spec, '- **blueprint**').item;
  const epicItem = sliceSameIndent(spec, '- **epic**').item;
  const doNotTouchItem = sliceSameIndent(spec, '- **Do not touch**').item;
  const goalAt = spec.indexOf('- **Goal & intent**');
  const goalItem = sliceSameIndent(spec, '- **Goal & intent**').item;
  const touchItem = sliceSameIndent(spec, '- **Touch**: write').item;
  const checklistItem = sliceSameIndent(spec, '- **Checklist**: order').item;
  const fingerprintParas = [
    contractSection(read('references/review/index.md')),
    contractSection(read('references/context-review/index.md')),
    firstFingerprintItem(read('agents/bouncer-reviewer.md')),
    firstFingerprintItem(read('agents/bouncer-context-reviewer.md')),
  ];

  assert.match(blueprintItem, /contract only/i); assert.match(blueprintItem, /no implementation code/i);
  assert.match(blueprintItem, /20 lines/); assert.match(blueprintItem, /~250 lines/);
  assert.match(blueprintItem, /As-Is\/To-Be/); assert.match(blueprintItem, /defer[^.]*tasks\.md/i);
  assert.match(blueprintItem, /One-commit justification[^.]*split/i);
  assert.match(epicItem, /two sentences/); assert.match(epicItem, /what changes and where/);
  assert.match(epicItem, /do not (rewrite|edit) existing (index )?lines/i);
  assert.match(doNotTouchItem, /Out of scope/);
  assert.ok(goalAt > -1); assert.match(goalItem, /acceptance/); assert.match(goalItem, /verify command/);
  assert.match(touchItem, /backticks/);
  assert.match(checklistItem, /acceptance criteria and the verify command/);
  for (const para of fingerprintParas) {
    assert.match(para, /trim/); assert.match(para, /lowercase/);
    assert.match(para, /`\/`/); assert.match(para, /`\.\/`/);
  }
});
